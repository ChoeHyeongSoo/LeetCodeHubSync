const fs = require('fs/promises');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(require('child_process').exec);

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const TARGET_FOLDER = 'LeetCode';

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
                recentAcSubmissionList(username: "Eugene603", limit: 20) {
                    id
                    statusDisplay
                }
            }
            `
        })
    });

    const data = await response.json();
    // 디버깅용 로그 : 목록 확인
    // console.log("1. 리트코드 목록 요청 응답:", JSON.stringify(data).substring(0, 250));
    const submissions = data.data?.recentAcSubmissionList || [];
    return submissions.filter(sub => sub.statusDisplay === 'Accepted');
}

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
                    memory
                    runtime
                    question {
                        questionFrontendId
                        title
                        titleSlug
                        content
                        difficulty
                        topicTags {
                            name
                        }
                    }
                    lang {
                        name
                        verboseName
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

async function main() {
    if (!LEETCODE_SESSION) {
        console.error("Error: LEETCODE_SESSION 환경변수가 설정되지 않았습니다.");
        process.exit(1);
    }

    console.log("리트코드 API에서 최근 통과 기록을 조회합니다...");
    const acceptedSubmissions = await getRecentSubmissions();
    console.log(`✅ 통과한 문제 ${acceptedSubmissions.length}개 발견`);

    for (const sub of acceptedSubmissions) {
        const details = await getSubmissionDetails(sub.id);
        if (!details) continue;

        const { code, question, lang, memory, runtime } = details;
        const { difficulty, title, titleSlug, content, questionFrontendId, topicTags } = question;

        const safeTitle = title.replace(/[<>:"\/\\|?*]/g, '');
        const folderName = `${questionFrontendId}. ${safeTitle}`;
        const savePath = path.join(TARGET_FOLDER, difficulty, folderName);

        await fs.mkdir(savePath, { recursive: true });

        const ext = { 'java': '.java', 'python3': '.py', 'python': '.py', 'cpp': '.cpp', 'javascript': '.js' }[lang.name] || '.txt';
        const topics = topicTags ? topicTags.map(t => t.name).join(', ') : "None";

        const codeFilePath = path.join(savePath, `${safeTitle}${ext}`);
        const readmeFilePath = path.join(savePath, 'README.md');

        // 리드미 커스터마이징 부분
        const readmeContent = `# [${difficulty}] [${title}](https://leetcode.com/problems/${titleSlug}/) - ${questionFrontendId}\n\n`
            + `### 성능 요약\n메모리: ${memory}, 시간: ${runtime}\n\n`
            + `### 분류\n${topics}\n\n`
            + `### 문제 설명\n${content}\n`;
        // ===================================================================================================================================

        await fs.writeFile(codeFilePath, code, 'utf8');
        await fs.writeFile(readmeFilePath, readmeContent, 'utf8');

        // 커밋 커스터마이징 부분
        const fullCommitMsg = `[${questionFrontendId}] ${title} - ${lang.verboseName || lang.name} (${runtime}, ${memory})\n\n[Category]\n${topics}`;

        try {
            await execAsync(`git add "${savePath}"`);
            await fs.writeFile('.commit_msg.txt', fullCommitMsg, 'utf8');
            await execAsync(`git commit -F .commit_msg.txt`);
            console.log(`✅ 커밋 성공: ${folderName}`);
        } catch (error) {
            console.log(`변경사항 x: ${folderName}`);
        }
        // ===================================================================================================================================
    }
}

main();
