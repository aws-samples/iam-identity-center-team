import { getSettings, getSettingsAdmin, listSettings } from "./queries";

describe("Settings query security contract", () => {
  test("non-admin settings queries do not request slackToken", () => {
    expect(getSettings).not.toMatch(/\bslackToken\b/);
    expect(listSettings).not.toMatch(/\bslackToken\b/);
  });

  test("admin settings query requests slackToken", () => {
    expect(getSettingsAdmin).toMatch(/\bslackToken\b/);
  });
});

