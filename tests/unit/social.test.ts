import { describe, expect, it } from "vitest";
import { parseHandle, parseSocialUrl, socialDisplay, socialHref } from "@/lib/social";

describe("social links", () => {
  it("keeps just the handle from whatever people paste", () => {
    expect(parseHandle("instagram", "@kwame.cuts")).toBe("kwame.cuts");
    expect(parseHandle("instagram", "https://www.instagram.com/kwame.cuts/?igsh=abc")).toBe("kwame.cuts");
    expect(parseHandle("tiktok", "tiktok.com/@ama_braids")).toBe("ama_braids");
    expect(parseHandle("x", "https://twitter.com/kwamecuts")).toBe("kwamecuts");
    expect(parseHandle("instagram", "")).toBeNull();
  });

  it("refuses the wrong site or impossible handles", () => {
    expect(parseHandle("instagram", "https://tiktok.com/@ama")).toBeUndefined();
    expect(parseHandle("x", "this handle is too long for x")).toBeUndefined();
    expect(parseHandle("instagram", "bad handle!")).toBeUndefined();
  });

  it("cleans page URLs and adds https", () => {
    expect(parseSocialUrl("facebook", "facebook.com/kwamecuts")).toBe("https://facebook.com/kwamecuts");
    expect(parseSocialUrl("youtube", "http://youtube.com/@lensbykofi")).toBe("https://youtube.com/@lensbykofi");
    expect(parseSocialUrl("website", "kwamecuts.com")).toBe("https://kwamecuts.com");
    expect(parseSocialUrl("facebook", "https://evil.example/facebook.com")).toBeUndefined();
    expect(parseSocialUrl("youtube", "youtube.com")).toBeUndefined(); // a channel, not the site
    expect(parseSocialUrl("website", "not a url")).toBeUndefined();
  });

  it("builds links and short labels", () => {
    expect(socialHref("tiktok", "ama_braids")).toBe("https://www.tiktok.com/@ama_braids");
    expect(socialDisplay("instagram", "kwame.cuts")).toBe("@kwame.cuts");
    expect(socialDisplay("website", "https://www.kwamecuts.com")).toBe("kwamecuts.com");
  });
});
