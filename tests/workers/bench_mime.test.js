import { describe, it, expect } from "vitest";
import { extractTextFromHtml } from "../../workers/shared/mime.js";

describe("Benchmark extractTextFromHtml", () => {
  it("benchmarks execution time on medium HTML", () => {
    // Generate a 2MB HTML string
    const paragraph = "<div class='foo' id='bar'><script>var x = 1; for(var i=0;i<100;i++) console.log(i);</script><style>.foo { color: red; }</style><p style='color:red'>Lorem ipsum <b>dolor</b> sit amet, <a href='#'>consectetur</a> adipiscing elit.</p></div>\n";
    const repeatCount = 10000; // ~2.5MB
    const html = "<html><body>" + paragraph.repeat(repeatCount) + "</body></html>";

    const start = performance.now();
    const result = extractTextFromHtml(html);
    const end = performance.now();

    console.log(`Execution time for 2.5MB HTML: ${(end - start).toFixed(2)}ms`);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(html.length);

    // Check truncation (default limit 102400)
    // The result length depends on how much text remains after stripping
    // But since input > 102400, output should be derived from truncated input.
    // Let's explicitly test limit parameter.

    const longHtml = "a".repeat(200000);
    const truncatedResult = extractTextFromHtml(longHtml, 50000);
    expect(truncatedResult.length).toBe(50000); // No tags, so length should be exactly limit

    const truncatedResultDefault = extractTextFromHtml(longHtml);
    expect(truncatedResultDefault.length).toBe(102400);
  });
});
