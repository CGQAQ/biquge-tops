// ranking url
import {
  Dom,
  Github,
  createActionAuth,
  format,
  b64Encode,
  addPaddingToBase64url,
  Buffer,
} from "./deps.ts";
const { DOMParser } = Dom;

const URL = "https://www.biquge.co/paihangbang/";
const gbkTextDecoder = new TextDecoder("gbk");

const resp = await fetch(URL);
const content = gbkTextDecoder.decode(await resp.arrayBuffer());
const doc = new DOMParser().parseFromString(content, "text/html");
// #main > .box
const container = doc?.querySelectorAll("#main > .box");

if (!container) {
  throw new Error("container is null");
}

const result = {
  lastUpdate: Date.now(),
  data: [...container].map((category) => {
    const element = category as unknown as Dom.Element;
    const title = element.querySelector("h3")?.textContent;

    const list = [...element.querySelectorAll("li > a")].map((node) => {
      const element = node as unknown as Dom.Element;
      return {
        href: element.getAttribute("href"),
        title: element.textContent,
      };
    });

    return {
      title,
      list,
    };
  }),
};

const auth = createActionAuth();
const authed = await auth();
const github = new Github({
  auth: authed.token,
});

const time = format(new Date(), "yyyy_MM_dd");
const time2 = format(new Date(), "yyyy-MM-dd hh:mm:ss");
const commitArg = {
  owner: Deno.env.get("GITHUB_ACTOR") || "",
  repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
  path: `rankings/rankings-${time}.json`,
  message: `update ranking ${time2}`,
  // content: addPaddingToBase64url(
  //   b64Encode(new TextEncoder().encode(JSON.stringify(result)))
  // ),
  content: Buffer.from(JSON.stringify(result)).toString("base64"),
  committer: {
    name: Deno.env.get("CGQAQ_NAME") || "dependabot[bot]",
    email:
      Deno.env.get("CGQAQ_EMAIL") || "15936231+CGQAQ@users.noreply.github.com",
  },
  author: {
    name: Deno.env.get("CGQAQ_NAME") || "dependabot[bot]",
    email:
      Deno.env.get("CGQAQ_EMAIL") || "15936231+CGQAQ@users.noreply.github.com",
  },
};

// get default branch hash
const { data: defaultBranch } = await github.repos.get({
  owner: commitArg.owner,
  repo: commitArg.repo,
});

try {
  // check branch exist
  await github.repos.getBranch({
    owner: commitArg.owner,
    repo: commitArg.repo,
    branch: time,
  });
} catch {
  // get branch hash
  const { data: branch } = await github.repos.getBranch({
    owner: commitArg.owner,
    repo: commitArg.repo,
    branch: defaultBranch.default_branch,
  });

  // create a branch called today
  await github.git.createRef({
    owner: commitArg.owner,
    repo: commitArg.repo,
    ref: `refs/heads/${time}`,
    sha: branch.commit.sha,
  });
} finally {
  const meta1 = await github.request(
    "GET /repos/{owner}/{repo}/contents/{file_path}{?ref}",
    {
      owner: Deno.env.get("GITHUB_ACTOR") || "",
      repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
      file_path: `rankings/rankings-${time}.json`,
      ref: time,
    }
  );

  await github.rest.repos.createOrUpdateFileContents({
    ...commitArg,
    sha: meta1?.data?.sha || undefined,
    branch: time,
  });

  const meta2 = await github.request(
    "GET /repos/{owner}/{repo}/contents/{file_path}{?ref}",
    {
      owner: Deno.env.get("GITHUB_ACTOR") || "",
      repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
      file_path: `rankings/rankings-latest.json`,
      ref: time,
    }
  );
  await github.rest.repos.createOrUpdateFileContents({
    ...commitArg,
    path: `rankings/rankings-latest.json`,
    sha: meta2?.data?.sha || undefined,
    branch: time,
  });

  const pr = await github.rest.pulls.create({
    owner: commitArg.owner,
    repo: commitArg.repo,
    title: `update ranking ${time2}`,
    head: time,
    base: defaultBranch.default_branch,
    body: `# New ranking: 
### UpdateTime: ${time2}
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`,
  });

  // merge: squash
  await github.rest.pulls.merge({
    owner: commitArg.owner,
    repo: commitArg.repo,
    pull_number: pr.data.number,
    merge_method: "squash",
    commit_message: "auto merged by github action",
  });

  // delete branch
  await github.rest.git.deleteRef({
    owner: commitArg.owner,
    repo: commitArg.repo,
    ref: `refs/heads/${time}`,
  });
}
