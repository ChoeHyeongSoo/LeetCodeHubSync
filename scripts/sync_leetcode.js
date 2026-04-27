const fs = require('fs/promises');
const path = require('path');

// 환경변수 및 기본 설정
const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const TARGET_FOLDER = 'LeetCode';

// 언어별 확장자 매핑
const EXTENSION_MAP = {
    'java': '.java',
    'python': '.py',
    'python3': '.py',
    'cpp': '.cpp',
    'javascript': '.js',
    'mysql': '.sql'
};

// 최근 통과한 제출 기록 Loading
async function getRecentSubmissions() {
    const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Cookie': `LEETCODE_SESSION=${LEETCODE_SESSION};`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `
            query recentAcSubmissions {
                recentAcSubmissionList(username: "", limit: 20) {
                    id
                    statusDisplay
                }
            }
            `
        })
    });

    const data = await response.json();
    const submissions = data.data?.recentAcSubmissionList || [];
    return submissions.filter(sub => sub.statusDisplay === 'Accepted').map(sub => sub.id);
}

// 제출 ID로 상세 코드 및 난이도 가져오기
async function getSubmissionDetails(id) {
    const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Cookie': `LEETCODE_SESSION=${LEETCODE_SESSION};`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `
            query submissionDetails($id: Int!) {
                submissionDetails(submissionId: $id) {
                    code
                    question {
                        titleSlug
                        difficulty
                    }
                    lang {
                        name
                    }
                }
            }
            `,
            variables: { id: parseInt(id) }
        })
    });
    const data = await response.json();
    return data.data?.submissionDetails;
}

// 메인 실행 함수 구현
async function main() {
    if (!LEETCODE_SESSION) {
        console.error("Error: LEETCODE_SESSION 환경변수가 설정되지 않았습니다.");
        process.exit(1);
    }

    console.log("리트코드 API에서 최근 통과 기록을 조회합니다...");
    const acceptedIds = await getRecentSubmissions();

    for (const subId of acceptedIds) {
        const details = await getSubmissionDetails(subId);
        if (!details) continue;

        const code = details.code;
        const difficulty = details.question.difficulty;
        const problemSlug = details.question.titleSlug;
        const langName = details.lang.name;

        const ext = EXTENSION_MAP[langName] || '.txt';
        const fileName = `Solution${ext}`;

        // 폴더 경로 생성
        const savePath = path.join(TARGET_FOLDER, difficulty, problemSlug);

        // 폴더 없으면 생성 (recursive 옵션 : 상위 폴더까지 한 번에 생성)
        await fs.mkdir(savePath, { recursive: true });

        const filePath = path.join(savePath, fileName);

        try {
            // 파일 존재 확인
            await fs.access(filePath);
            console.log(`이미 존재함: ${filePath}`);
        } catch {
            // 파일이 없으므로 새로 쓰기 (utf8 인코딩)
            await fs.writeFile(filePath, code, 'utf8');
            console.log(`새로 저장됨: ${filePath}`);
        }
    }
}

main();