import { describe, it, expect } from "vitest";
import { listTemplates, getTemplate, getTemplateNames } from "../src/prompt-templates";
import { reviewCode } from "../src/code-reviewer";
import { generateTests } from "../src/test-generator";

describe("prompt-templates", () => {
  it("should list all templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty("name");
    expect(templates[0]).toHaveProperty("description");
  });

  it("should get template by name", () => {
    const template = getTemplate("api-endpoint");
    expect(template).toBeDefined();
    expect(template?.name).toBe("api-endpoint");
    expect(template?.content.length).toBeGreaterThan(0);
  });

  it("should return undefined for unknown template", () => {
    const template = getTemplate("nonexistent-template");
    expect(template).toBeUndefined();
  });

  it("should get template names", () => {
    const names = getTemplateNames();
    expect(names).toContain("api-endpoint");
    expect(names.length).toBeGreaterThan(0);
  });
});

describe("code-reviewer", () => {
  it("should detect hardcoded secrets", () => {
    const code = `const secret_token = "sk-1234567890abcdef";`;
    const report = reviewCode(code, "test.ts");
    const hasSecretIssue = report.issues.some(
      (i) => i.category === "security"
    );
    expect(hasSecretIssue).toBe(true);
  });

  it("should pass clean code", () => {
    const code = `const x: number = 1 + 2;`;
    const report = reviewCode(code, "test.ts");
    expect(report.issues.length).toBe(0);
  });

  it("should return a valid report", () => {
    const report = reviewCode(`const x = 1;`, "test.ts");
    expect(report).toHaveProperty("file");
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("issues");
    expect(report).toHaveProperty("score");
  });
});

describe("test-generator", () => {
  it("should generate test code", () => {
    const code = `export function add(a: number, b: number): number { return a + b; }`;
    const result = generateTests(code, "add.ts");
    expect(result).toContain("add");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should support different frameworks", () => {
    const code = `export function greet(name: string): string { return "Hello " + name; }`;
    const vitestResult = generateTests(code, "greet.ts", "vitest");
    const jestResult = generateTests(code, "greet.ts", "jest");
    expect(vitestResult.length).toBeGreaterThan(0);
    expect(jestResult.length).toBeGreaterThan(0);
  });
});
