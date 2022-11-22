console.log("hello world from deno");

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

const result = [...container].map((category) => {
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
});

const auth = createActionAuth();
const authed = await auth();
const github = new Github({
  auth: authed.token,
});

console.log("whoami: ", await github.auth());
console.log("GITHUB_ACTOR: ", Deno.env.get("GITHUB_ACTOR"));
console.log("GITHUB_REPOSITORY: ", Deno.env.get("GITHUB_REPOSITORY"));

const time = format(new Date(), "yyyy-MM-dd hh:mm:ss");
const x = await github.rest.repos.createOrUpdateFileContents({
  owner: Deno.env.get("GITHUB_ACTOR") || "",
  repo: Deno.env.get("GITHUB_REPOSITORY")?.split("/")?.[1] || "",
  path: `rankings/ranking-${time}.json`,
  message: `update ranking ${time}`,
  // content: addPaddingToBase64url(
  //   b64Encode(new TextEncoder().encode(JSON.stringify(result)))
  // ),
  content: Buffer.from(JSON.stringify(result)).toString("base64"),
});
console.log("after");

console.log(x);
