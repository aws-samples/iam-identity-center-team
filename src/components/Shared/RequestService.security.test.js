jest.mock("aws-amplify", () => ({
  API: {
    graphql: jest.fn(),
  },
  graphqlOperation: jest.fn((query, variables) => ({ query, variables })),
}));

jest.mock("../../graphql/queries", () => ({
  getSettings: "GET_SETTINGS_QUERY",
  getSettingsAdmin: "GET_SETTINGS_ADMIN_QUERY",
}));

jest.mock("../../graphql/mutations", () => ({}));

import { API, graphqlOperation } from "aws-amplify";
import { getSetting, getSettingAdmin } from "./RequestService";

describe("RequestService settings access separation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    graphqlOperation.mockReturnValue("GRAPHQL_OPERATION_PAYLOAD");
  });

  test("getSetting uses non-admin settings query", async () => {
    API.graphql.mockResolvedValue({
      data: {
        getSettings: { id: "settings" },
      },
    });

    const result = await getSetting("settings");

    expect(graphqlOperation).toHaveBeenCalledWith("GET_SETTINGS_QUERY", {
      id: "settings",
    });
    expect(API.graphql).toHaveBeenCalledWith("GRAPHQL_OPERATION_PAYLOAD");
    expect(result).toEqual({ id: "settings" });
  });

  test("getSettingAdmin uses admin settings query", async () => {
    API.graphql.mockResolvedValue({
      data: {
        getSettings: { id: "settings", slackToken: "xoxb-123" },
      },
    });

    const result = await getSettingAdmin("settings");

    expect(graphqlOperation).toHaveBeenCalledWith("GET_SETTINGS_ADMIN_QUERY", {
      id: "settings",
    });
    expect(API.graphql).toHaveBeenCalledWith("GRAPHQL_OPERATION_PAYLOAD");
    expect(result).toEqual({ id: "settings", slackToken: "xoxb-123" });
  });
});
