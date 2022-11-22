console.log("hello world from deno");

// ranking url
import { Dom, Github, createActionAuth } from "./deps.ts";
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
const myProjs = (
  await github.projects.listForUser({
    username: "cgqaq",
  })
).data;

console.log(myProjs);
