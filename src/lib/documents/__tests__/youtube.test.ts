import { describe, expect, test } from "vitest";
import { buildYouTubeEmbedUrl, buildYouTubeWatchUrl, extractYouTubeVideoId } from "@/lib/documents/youtube";

const VALID_ID = "dQw4w9WgXcQ";

describe("extractYouTubeVideoId — supported forms", () => {
  test("a standard watch URL", () => {
    expect(extractYouTubeVideoId(`https://youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  test("a www. watch URL", () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  test("a youtu.be short URL", () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  test("a Shorts URL", () => {
    expect(extractYouTubeVideoId(`https://youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
  });

  test("a watch URL with extra query params (e.g. a timestamp) still extracts the id", () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}&t=42s`)).toBe(VALID_ID);
  });

  test("a URL pasted without a scheme still works", () => {
    expect(extractYouTubeVideoId(`youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  test("the m. (mobile) subdomain is accepted", () => {
    expect(extractYouTubeVideoId(`https://m.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  test("trims surrounding whitespace", () => {
    expect(extractYouTubeVideoId(`  https://youtu.be/${VALID_ID}  `)).toBe(VALID_ID);
  });
});

describe("extractYouTubeVideoId — rejections", () => {
  test("an empty string", () => {
    expect(extractYouTubeVideoId("")).toBeNull();
  });

  test("a completely malformed string", () => {
    expect(extractYouTubeVideoId("not a url at all")).toBeNull();
  });

  test("a non-YouTube host", () => {
    expect(extractYouTubeVideoId(`https://vimeo.com/watch?v=${VALID_ID}`)).toBeNull();
  });

  test("a host-spoofing attempt using youtube.com as a subdomain of an attacker domain", () => {
    expect(extractYouTubeVideoId(`https://youtube.com.evil.com/watch?v=${VALID_ID}`)).toBeNull();
  });

  test("a host-spoofing attempt embedding youtube.com in the path, not the host", () => {
    expect(extractYouTubeVideoId(`https://evil.com/youtube.com/watch?v=${VALID_ID}`)).toBeNull();
  });

  test("an arbitrary/malicious iframe-style URL on an unrelated host", () => {
    expect(extractYouTubeVideoId("https://evil.example.com/embed/malicious")).toBeNull();
  });

  test("a video id that is too short", () => {
    expect(extractYouTubeVideoId("https://youtu.be/short")).toBeNull();
  });

  test("a video id that is too long", () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}extra`)).toBeNull();
  });

  test("a video id containing an invalid character", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9Wg$cQ")).toBeNull();
  });

  test("a watch URL with no v= parameter at all", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });

  test("the YouTube homepage with no video reference", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull();
  });

  test("a non-http(s) scheme", () => {
    expect(extractYouTubeVideoId(`javascript://youtube.com/watch?v=${VALID_ID}`)).toBeNull();
  });
});

describe("buildYouTubeEmbedUrl", () => {
  test("uses the privacy-enhanced youtube-nocookie.com origin", () => {
    expect(buildYouTubeEmbedUrl(VALID_ID)).toBe(`https://www.youtube-nocookie.com/embed/${VALID_ID}`);
  });
});

describe("buildYouTubeWatchUrl", () => {
  test("builds the canonical watch URL from the id, regardless of the original URL form", () => {
    expect(buildYouTubeWatchUrl(VALID_ID)).toBe(`https://www.youtube.com/watch?v=${VALID_ID}`);
  });
});
