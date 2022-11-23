// Copyright (c) 2022, CGQAQ
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:

// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.

// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.

// 3. Neither the name of the copyright holder nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

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
  content: Buffer.from(JSON.stringify(result, null, 2)).toString("base64"),
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

const newBranchName = time2.replace(/ /g, "_").replace(/:/g, "_");
try {
  // check branch exist
  await github.repos.getBranch({
    owner: commitArg.owner,
    repo: commitArg.repo,
    branch: newBranchName,
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
    ref: `refs/heads/${newBranchName}`,
    sha: branch.commit.sha,
  });
}

let meta1, meta2;
try {
  meta1 = await github.request(
    "GET /repos/{owner}/{repo}/contents/{file_path}{?ref}",
    {
      owner: Deno.env.get("GITHUB_ACTOR") || "",
      repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
      file_path: `rankings/rankings-${time}.json`,
      ref: newBranchName,
    }
  );
} catch {
  /* NOOP */
}

try {
  meta2 = await github.request(
    "GET /repos/{owner}/{repo}/contents/{file_path}{?ref}",
    {
      owner: Deno.env.get("GITHUB_ACTOR") || "",
      repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
      file_path: `rankings/rankings-latest.json`,
      ref: newBranchName,
    }
  );
} catch {
  /* NOOP */
}

console.log("meta1", meta1?.data?.sha || undefined);
console.log("meta2", meta2?.data?.sha || undefined);
await github.rest.repos.createOrUpdateFileContents({
  ...commitArg,
  sha: meta1?.data?.sha || undefined,
  branch: newBranchName,
});

await github.rest.repos.createOrUpdateFileContents({
  ...commitArg,
  path: `rankings/rankings-latest.json`,
  sha: meta2?.data?.sha || undefined,
  branch: newBranchName,
});

const pr = await github.rest.pulls.create({
  owner: commitArg.owner,
  repo: commitArg.repo,
  title: `update ranking ${time2}`,
  head: newBranchName,
  base: defaultBranch.default_branch,
  body: `# New ranking: 
### UpdateTime: ${newBranchName}
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
  ref: `heads/${newBranchName}`,
});
