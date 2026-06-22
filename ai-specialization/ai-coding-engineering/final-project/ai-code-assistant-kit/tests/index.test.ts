import { describe, it, expect } from "vitest";
import { PromptTemplateEngine } from "../src/prompt-templates";
import { CodeReviewer } from "../src/code-reviewer";
import { TestGenerator } from "../src/test-generator";

describe("PromptTemplateEngine", () => {
  it("should render a template with variables", () => {
    const engine = new PromptTemplateEngine();
    engine.register({
      name: "test",
      template: "Hello {{name}}, you are {{age}} years old.",
      variables: ["name", "age"],
    });
    const result = engine.render("test", { name: "Alice", age: "30" });
    expect(result).toContain("Alice");
    expect(result).toContain("30");
  });

  it("should list registered templates", () => {
    const engine = new PromptTemplateEngine();
    engine.register({ name: "a", template: "A", variables: [] });
    engine.register({ name: "b", template: "B", variables: [] });
    expect(engine.list()).toContain("a");
    expect(engine.list()).toContain("b");
  });
});

describe("CodeReviewer", () => {
  it("should detect hardcoded secrets", () => {
    const reviewer = new CodeReviewer();
    const code = `const API_KEY = "sk-1234567890abcdef";`;
    const issues = reviewer.review(code, "test.ts");
    const hasSecretIssue = issues.some((i) => i.rule === "hardcoded-secret");
    expect(hasSecretIssue).toBe(true);
  });

  it("should pass clean code", () => {
    const reviewer = new CodeReviewer();
    const code = `const x = 1 + 2;`;
    const issues = reviewer.review(code, "test.ts");
    expect(issues.length).toBe(0);
  });
});

describe("TestGenerator", () => {
  it("should generate test suggestions", () => {
    const generator = new TestGenerator();
    const code = `function add(a: number, b: number): number { return a + b; }`;
    const suggestions = generator.suggestTests(code, "add");
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
