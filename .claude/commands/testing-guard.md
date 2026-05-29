---
name: testing-guard
description: Use this skill whenever implementing, modifying, or debugging application features. This skill enforces Specification by Example, GIVEN-WHEN-THEN acceptance criteria, automated tests, regression protection, and all-green test reporting before completion.
---


# Testing Guard Skill

## Purpose

This skill ensures that Claude Code does not only write or modify code, but also creates testing protection before reporting completion.

Use this skill whenever the task involves:

- Building a new feature
- Modifying an existing feature
- Fixing a bug
- Refactoring code
- Changing UI behavior
- Changing API behavior
- Changing business rules
- Changing data validation
- Changing form behavior
- Changing database logic
- Changing authentication or permission logic

The goal is to reduce repeated manual test-run cycles and prevent this pattern:

Requirement → Code → Manual test → Bug → Fix → New bug → Fix again → Break another flow.

Claude Code must convert requirements into verifiable examples, create tests, run tests, fix failures, and only report completion when the final result is verified.

---

# Core Principle

Do not treat the user's instruction as only a coding request.

Treat every development request as:

1. A requirement clarification task
2. A specification task
3. A test design task
4. An implementation task
5. A verification task
6. A regression-protection task

A task is not complete until the relevant tests pass.

---

# Required Workflow

For every feature, bug fix, or behavior change, follow this workflow:

1. Read the user's request carefully.
2. Inspect the relevant project files.
3. Identify the business rules and expected behavior.
4. Convert the requirement into GIVEN-WHEN-THEN scenarios.
5. Identify unclear rules and mark them as TODO instead of guessing.
6. Create or update tests for every important scenario.
7. Implement or modify the feature.
8. Run the relevant tests.
9. If tests fail, fix the code and rerun tests.
10. Repeat until tests are green.
11. Run relevant regression tests when the change may affect existing behavior.
12. Report the result with a clear test report.

Do not report completion if tests were not created or not executed.

---

# Specification by Example

Use Specification by Example for important business logic.

Every important requirement should be expressed through concrete examples.

Use this format:

```md
Scenario: Scenario name

Given: Precondition
When: User action or system event
Then: Expected result
```

Example:

```md
Scenario: User submits a valid order form

Given: The user has filled in all required fields
When: The user clicks the submit button
Then: The system should create the order and show a success message
```

The purpose is to make the requirement precise, testable, and less dependent on assumptions.

---

# GIVEN-WHEN-THEN Rules

Every GIVEN-WHEN-THEN scenario must be testable.

Each scenario should have:

* A clear starting condition
* A clear user action or system event
* A clear expected result
* A result that can be verified by automated test, API response, database state, or UI assertion

Avoid vague expectations such as:

* "It should work"
* "It should be normal"
* "It should look good"
* "The user experience should be smooth"

Replace vague expectations with observable results.

Bad:

```md
Then: The page should work correctly
```

Good:

```md
Then: The page should display the success message "Order submitted successfully"
And: The submit button should be disabled during submission
And: The new order should appear in the order list
```

---

# Required Scenario Coverage

When creating scenarios, consider at least the following categories:

## 1. Happy Path

Normal successful user flow.

## 2. Required Field Missing

Required input is missing.

## 3. Invalid Input

Input format or value is invalid.

## 4. Boundary Condition

The exact limit or edge case.

## 5. Timeout or Expiration

Rules related to time limits.

## 6. Empty State

No data exists.

## 7. Duplicate Action

User clicks repeatedly or submits the same action twice.

## 8. API Failure

Backend or third-party service fails.

## 9. Permission or Role Restriction

User does not have the required permission.

## 10. Regression Protection

Existing behavior that must not be broken.

---

# Do Not Guess Business Rules

If the requirement is unclear, do not silently decide the behavior.

Mark unclear points as TODO:

```md
TODO: Need confirmation whether the exact 15th minute counts as late.
TODO: Need confirmation whether API failure should show retry button.
```

If a decision is necessary to continue, choose the safest minimal behavior and clearly report the assumption.

---

# Test Creation Rules

Every important GIVEN-WHEN-THEN scenario should have a corresponding test.

If the project has no test framework, create the smallest useful test setup before implementing the feature.

Suggested defaults:

* React / Vite / frontend logic: Vitest
* React UI behavior: Vitest + Testing Library
* Next.js: Vitest or Playwright
* Node.js backend: Vitest or Jest
* API integration: Supertest
* Full browser flow: Playwright
* Python: pytest
* Ruby: RSpec
* Laravel / PHP: PHPUnit or Pest

---

# Bug Fix Rules

When fixing a bug:

1. Reproduce the bug if possible.
2. Identify the root cause.
3. Add a failing test that proves the bug exists.
4. Fix the code.
5. Rerun the test and confirm it passes.
6. Run related regression tests.
7. Report the root cause, fix, and test result.

---

# Do Not Lower Quality Gates

Never do these things:

* Delete failing tests to make the report green
* Skip tests without explanation
* Change expected results to match broken behavior
* Report "completed" without running tests
* Claim tests passed without showing what was run
* Modify unrelated files without explaining why

---

# Reporting Format

After completing the task, report using this format:

## Development Completion Report

### 1. Completed Work
Summary of what was implemented or changed.

### 2. Acceptance Scenarios
List the GIVEN-WHEN-THEN scenarios used.

### 3. Test Results
```
✅ Scenario: [name]
Expected: [result]
Actual: [result]
Result: Passed

❌ Scenario: [name]
Expected: [result]
Actual: [result]
Fix: [what was done]
Retest result: Passed
```

### 4. Commands Run
List the actual commands executed.

### 5. Files Changed
* `path/to/file`: Reason for change.

### 6. Uncovered or Pending Items
TODOs and assumptions requiring user confirmation.

---

# Final Rule

Do not optimize for appearing finished.

Optimize for verified correctness.

The correct delivery is not "Done."

The correct delivery is:
"Implemented, tested, failures fixed, regression checked, and remaining uncertainties clearly listed."
