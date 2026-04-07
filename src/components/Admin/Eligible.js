// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, {useState, useEffect} from "react";
import {
    Box,
    Button,
    Header,
    Pagination,
    Table,
    TextFilter,
    SpaceBetween,
    CollectionPreferences,
    Multiselect,
    TextContent,
    Modal,
    FormField,
    ButtonDropdown,
    Form,
    Select,
    ColumnLayout,
    Toggle,
    Input,
    Spinner,
    RadioGroup,
    Icon,
    Grid
} from "@awsui/components-react";
import {useCollection} from "@awsui/collection-hooks";
import Ous from "../Shared/Ous";
import {API, graphqlOperation} from "aws-amplify";
import {onPublishOUs, onPublishPermissions} from "../../graphql/subscriptions";
import {
    fetchAccounts,
    fetchOUs,
    fetchIdCGroups,
    fetchPermissions,
    addPolicy,
    editPolicy,
    delPolicy,
    fetchUsers,
    getAllEligibility,
    getSetting, getAllApprovers, getAllPoliciesWithAccounts
} from "../Shared/RequestService";
import {
    EligibilityMode,
    DEFAULT_ELIGIBILITY_MODE,
    ELIGIBILITY_MODE_OPTIONS
} from "../Shared/eligibilityModes";
import "../../index.css";

const COLUMN_DEFINITIONS = [
    {
        id: "id",
        sortingField: "id",
        header: "Id",
        cell: (item) => item.id,
        width: 140,
    },
    {
        id: "name",
        sortingField: "name",
        header: "Name",
        cell: (item) => item.name,
        width: 220,
    },
    {
        id: "type",
        sortingField: "type",
        header: "Type",
        cell: (item) => item.type,
        width: 130,
    },
    {
        id: "ticketNo",
        sortingField: "ticketNo",
        header: "TicketNo",
        cell: (item) => item.ticketNo || "-",
        width: 130,
    },
    {
        id: "policyId",
        sortingField: "policyId",
        header: "Policy",
        cell: (item) => {
            if (!item.policyId) return "legacy";
            if (item.corrupted) {
                return (
                    <SpaceBetween direction="horizontal" size="xs">
                        <Icon name="status-warning" variant="warning" />
                        <span>{item.policyId}</span>
                    </SpaceBetween>
                );
            }
            return item.policyId;
        },
        width: 200,
    },
    {
        id: "accounts",
        sortingField: "accounts",
        header: "Accounts",
        cell: (item) => (
            <>{item.accounts?.length > 0 ? <TextContent>
                <ul>
                    {item.accounts.map(({name}) => (
                        <li>{name}</li>
                    ))}
                </ul>
            </TextContent> : <TextContent>
                <ul>-</ul>
            </TextContent>}</>
        ),
        width: 200,
    },
    {
        id: "ous",
        sortingField: "ous",
        header: "OUs",
        cell: (item) => (
            <>{item.ous?.length > 0 ? <TextContent>
                <ul>
                    {item.ous.map(({name}) => (
                        <li>{name}</li>
                    ))}
                </ul>
            </TextContent> : <TextContent>
                <ul>-</ul>
            </TextContent>}</>
        ),
        width: 200,
    },
    {
        id: "permissions",
        sortingField: "permissions",
        header: "Permissions",
        cell: (item) => (
            <TextContent>
                <ul>
                    {item.permissions?.map(({name}) => (
                        <li>{name}</li>
                    ))}
                </ul>
            </TextContent>
        ),
        width: 200,
    },
    {
        id: "duration",
        sortingField: "duration",
        header: "Max duration",
        cell: (item) => `${item.duration} hours`,
        width: 120,
    },
    {
        id: "approvalRequired",
        sortingField: "approvalRequired",
        header: "Approval required",
        cell: (item) => item.approvalRequired ? "Yes" : "No",
        width: 130,
    },
];

const MyCollectionPreferences = ({preferences, setPreferences}) => {
    return (
        <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={({detail}) => setPreferences(detail)}
            pageSizePreference={{
                title: "Page size",
                options: [
                    {value: 10, label: "10 Policy"},
                    {value: 30, label: "30 Policy"},
                    {value: 50, label: "50 Policy"},
                ],
            }}
            wrapLinesPreference={{
                label: "Wrap lines",
                description: "Check to see all the text and wrap the lines",
            }}
            visibleContentPreference={{
                title: "Select visible columns",
                options: [
                    {
                        label: "Policy properties",
                        options: [
                            {id: "id", label: "Id"},
                            {id: "name", label: "name"},
                            {id: "type", label: "type"},
                            {id: "ticketNo", label: "ticketNo"},
                            {id: "accounts", label: "accounts"},
                            {id: "ous", label: "ous"},
                            {id: "permissions", label: "permissions"},
                            {id: "policyId", label: "policyId"},
                            {id: "duration", label: "duration"},
                            {id: "approvalRequired", label: "approvalRequired"},
                        ],
                    },
                ],
            }}
        />
    );
};

function EmptyState({title, subtitle, action}) {
    return (
        <Box textAlign="center">
            <Box variant="strong">{title}</Box>
            <Box variant="p" padding={{bottom: "s"}}>
                {subtitle}
            </Box>
            {action}
        </Box>
    );
}

const defaultType = {
    label: "All entities",
    value: "0",
};

function Eligible(props) {
    const [allItems, setAllItems] = useState([]);
    const [preferences, setPreferences] = useState({
        pageSize: 10,
        visibleContent: [
            // "id",
            "name",
            "type",
            "policyId",
            "ticketNo",
            "accounts",
            "ous",
            "permissions",
            "duration",
            "approvalRequired",
            "modifiedBy"
        ],
    });

    const [selectedOption, setSelectedOption] = useState(defaultType);
    const selectTypeOptions = prepareSelectOptions("type", defaultType);

    function prepareSelectOptions(field, defaultOption) {
        const optionSet = [];
        // Building a non redundant list of the field passed as parameter.

        allItems.forEach((item) => {
            if (optionSet.indexOf(item[field]) === -1) {
                optionSet.push(item[field]);
            }
        });
        optionSet.sort();

        // The first element is the default one.
        const options = [defaultOption];

        // Adding the other element ot the list.
        optionSet.forEach((item, index) =>
            options.push({label: item, value: (index + 1).toString()})
        );
        return options;
    }

    function matchesType(item, selectedType) {
        return selectedType === defaultType || item.type === selectedType.label;
    }

    const SEARCHABLE_COLUMNS = COLUMN_DEFINITIONS.map((item) => item.id);

    const {
        items,
        actions,
        filteredItemsCount,
        collectionProps,
        filterProps,
        paginationProps,
    } = useCollection(allItems, {
        filtering: {
            filteringFunction: (item, filteringText) => {
                if (!matchesType(item, selectedOption)) {
                    return false;
                }
                const filteringTextLowerCase = filteringText.toLowerCase();

                return SEARCHABLE_COLUMNS.map((key) => item[key]).some(
                    (value) =>
                        typeof value === "string" &&
                        value.toLowerCase().indexOf(filteringTextLowerCase) > -1
                );
            },
            empty: (
                <EmptyState
                    title="No Policy"
                    subtitle="No eligibility policy to display."
                    action={<Button onClick={handleAdd}>Create eligibility policy</Button>}
                />
            ),
            noMatch: (
                <EmptyState
                    title="No matches"
                    subtitle="Your search didn't return any records."
                    action={
                        <Button onClick={() => actions.setFiltering("")}>
                            Clear filter
                        </Button>
                    }
                />
            ),
        },
        pagination: {pageSize: preferences.pageSize},
        sorting: {},
        selection: {},
    });

    const {selectedItems} = collectionProps;
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(true);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [Type, setType] = useState("");
    const [typeError, setTypeError] = useState("");
    const [ticketNo, setTicketNo] = useState("");
    const [duration, setDuration] = useState("9");
    const [durationError, setDurationError] = useState("");
    const [approvalRequired, setApprovalRequired] = useState(true);
    const [ticketError, setTicketError] = useState("");
    const [resource, setResource] = useState("");
    const [resourceError, setResourceError] = useState("");
    const [account, setAccount] = useState([]);
    const [accountError, setAccountError] = useState("");
    const [ou, setOU] = useState([]);
    const [ouError, setOuError] = useState("");
    const [permission, setPermission] = useState([]);
    const [permissionError, setPermissionError] = useState("");
    const [policies, setPolicies] = useState([]);
    const [policiesStatus, setPoliciesStatus] = useState("finished");
    const [policiesError, setPoliciesError] = useState("");
    const [selectedPolicies, setSelectedPolicies] = useState([]);
    const [eligibilityMode, setEligibilityMode] = useState(DEFAULT_ELIGIBILITY_MODE);
    const [rawEligibilities, setRawEligibilities] = useState([]);
    const [allowLegacyEligibility, setAllowLegacyEligibility] = useState(true);

    const [accounts, setAccounts] = useState([]);
    const [accountStatus, setAccountStatus] = useState("finished");

    const [users, setUsers] = useState([]);
    const [userStatus, setUserStatus] = useState("finished");

    const [groups, setGroups] = useState([]);
    const [groupStatus, setGroupStatus] = useState("finished");

    const [ous, setOUs] = useState([]);
    const [ouStatus, setOUStatus] = useState("finished");

    const [permissions, setPermissions] = useState([]);
    const [permissionStatus, setPermissionStatus] = useState("finished");
    const [ticketRequired, setTicketRequired] = useState(true);


    useEffect(() => {
        views();
        props.addNotification([]);
        getOUs()
        getAccounts();
        getPermissions();
        loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function loadSettings() {
        getSetting("settings").then((data) => {
            const legacyAllowed = data?.allowLegacyEligibility ?? true;
            setAllowLegacyEligibility(legacyAllowed);
            // If legacy is not allowed and current mode is legacy, switch to policy-based
            if (!legacyAllowed && eligibilityMode === EligibilityMode.LEGACY) {
                setEligibilityMode(EligibilityMode.POLICY_BASED);
            }
        });
    }

    function views() {
        setPoliciesStatus("loading");
        Promise.all([getAllEligibility(), getAllPoliciesWithAccounts()]).then(([eligibility, policies]) => {
            const expandedItems = []
            if (eligibility.error || policies.error) {
                setAllItems([]);
                props.addNotification([
                    {
                        type: "error",
                        content: eligibility.error.message || policies.error.message,
                        dismissible: true,
                        onDismiss: () => props.addNotification([]),
                    }
                ])
            } else {
                setPolicies(policies)
                setPoliciesStatus("finished")
                setRawEligibilities(eligibility)
                eligibility.forEach((item) => {
                    if (item.policyIds?.length > 0) {
                        item.policyIds.forEach((policyId) => {
                            const policyFound = policies.find(p => p.id === policyId)
                            expandedItems.push({
                                id: item.id,
                                name: item.name,
                                type: item.type,
                                ticketNo: item.ticketNo,
                                policyId: policyId,
                                policyIds: item.policyIds,
                                accounts: policyFound?.resolvedAccounts || [],
                                ous: policyFound?.ous || [],
                                permissions: policyFound?.permissions || [],
                                duration: policyFound?.duration || "N/A",
                                approvalRequired: policyFound?.approvalRequired || false,
                                corrupted: !policyFound,
                            })
                        })
                    } else {
                        expandedItems.push(item)
                    }
                })
                setAllItems(expandedItems)
                }
        setTableLoading(false);
        setRefreshLoading(false);
        setConfirmLoading(false);
        setSubmitLoading(false);
        setVisible(false);
        setDeleteVisible(false);
        handleDismiss();
        getSettings()
        })
    }

    function handleRefresh() {
        setRefreshLoading(true);
        setTableLoading(true);
        props.addNotification([]);
        views();
    }

    function refreshPolicies() {
        setPoliciesStatus("loading");
        return getAllPoliciesWithAccounts().then((data) => {
            if (data.error) {
                setPoliciesError(data.error.message);
                return [];
            } else {
                setPolicies(data);
                setPoliciesError("");
                return data;
            }
        }).finally(() => {
            setPoliciesStatus("finished");
        });
    }

    function handleAdd() {
        setVisible(true);
    }

    function getSettings() {
        getSetting("settings").then((data) => {
            if (data !== null) {
                setTicketRequired(data.ticketNo);
                setDuration(data.duration)
            }
        });
    }

    function handleSelect(data) {
        if (data.detail.id === "delete") {
            setDeleteVisible(true);
        } else handleEdit();
    }

    function handleDelete() {
        selectedItems.forEach((item) => {
            setConfirmLoading(true);

            // Check if this is a policy-based eligibility with multiple policies
            if (item.policyId && item.policyIds && item.policyIds.length > 1) {
                // Remove only the selected policy from policyIds
                const updatedPolicyIds = item.policyIds.filter(pid => pid !== item.policyId);
                const data = {
                    id: item.id,
                    policyIds: updatedPolicyIds,
                    ticketNo: item.ticketNo || "",
                    accounts: [],
                    permissions: [],
                    ous: [],
                    approvalRequired: false,
                    duration: "0"
                };
                editPolicy(data)
                    .then(() => {
                        views();
                        props.addNotification([
                            {
                                type: "success",
                                content: `Policy removed from eligibility successfully`,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    })
                    .catch((err) => {
                        const errorMessage = err?.errors?.[0]?.message || "Failed to remove policy from eligibility";
                        props.addNotification([
                            {
                                type: "error",
                                content: errorMessage,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    });
            } else {
                // Delete entire eligibility (legacy or single policy)
                const data = {
                    id: item.id,
                };
                delPolicy(data)
                    .then(() => {
                        views();
                        props.addNotification([
                            {
                                type: "success",
                                content: `Eligibility deleted successfully`,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    })
                    .catch((err) => {
                        const errorMessage = err?.errors?.[0]?.message || "Failed to delete eligibility";
                        props.addNotification([
                            {
                                type: "error",
                                content: errorMessage,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    });
            }
        });
    }

    function handleConfirmEdit() {
        let action = "edit";
        validate(action).then((valid) => {
            if (valid) {
                setConfirmLoading(true);
                let data;
                if (eligibilityMode === EligibilityMode.POLICY_BASED) {
                    // Policy-based: policyIds and ticketNo, other fields come from policy
                    data = {
                        id: selectedItems[0].id,
                        policyIds: selectedPolicies.map(({value}) => value),
                        ticketNo: ticketNo,
                        // Default values (same as create)
                        accounts: [],
                        permissions: [],
                        ous: [],
                        approvalRequired: false,
                        duration: "0"
                    };
                } else {
                    // Legacy: store all fields directly
                    data = {
                        id: selectedItems[0].id,
                        accounts: account.map(({value, label}) => ({name: label, id: value})),
                        permissions: permission.map(({value, label}) => ({name: label, id: value})),
                        ous: ou.map(({value, label}) => ({name: label, id: value})),
                        policyIds: [],
                        ticketNo: ticketNo,
                        approvalRequired: approvalRequired,
                        duration: duration
                    };
                }
                console.log("Saving eligibility with data:", data);
                editPolicy(data).then((result) => {
                    console.log("editPolicy result:", result);
                    if (result) {
                        views();
                        props.addNotification([
                            {
                                type: "success",
                                content: `Eligibility policy updated successfully`,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    } else {
                        setConfirmLoading(false);
                        props.addNotification([
                            {
                                type: "error",
                                content: `Failed to update eligibility policy`,
                                dismissible: true,
                                onDismiss: () => props.addNotification([]),
                            },
                        ]);
                    }
                }).catch((err) => {
                    setConfirmLoading(false);
                    props.addNotification([
                        {
                            type: "error",
                            content: err.errors?.[0]?.message || "Error updating eligibility policy",
                            dismissible: true,
                            onDismiss: () => props.addNotification([]),
                        },
                    ]);
                });
            }
        });
    }

    function handleEdit() {
        // Determine if this is policy-based or legacy eligibility
        const isPolicyBased = selectedItems[0].policyIds && selectedItems[0].policyIds.length > 0;
        setEligibilityMode(isPolicyBased ? EligibilityMode.POLICY_BASED : EligibilityMode.LEGACY);

        // Set common fields
        setTicketNo(selectedItems[0].ticketNo || "");

        // Set legacy fields (will be empty for policy-based)
        setAccount(
            selectedItems[0].accounts?.map((data) => ({
                label: data.name,
                value: data.id,
                description: data.id,
            })) || []
        );
        setOU(
            selectedItems[0].ous?.map((data) => ({
                label: data.name,
                value: data.id,
                description: data.id,
            })) || []
        );
        setPermission(
            selectedItems[0].permissions?.map((data) => ({
                label: data.name,
                value: data.id,
                description: data.id,
            })) || []
        );
        setApprovalRequired(selectedItems[0].approvalRequired);
        setDuration(selectedItems[0].duration);

        if (isPolicyBased) {
            // Policy-based: set selected policies from existing data
            setSelectedPolicies(
                selectedItems[0].policyIds?.map((policyId) => {
                    const policyFound = policies.find(p => p.id === policyId);
                    return {
                        label: policyId,
                        value: policyId,
                        description: policyFound
                            ? `Accounts: ${policyFound.resolvedAccounts?.map(a => a.name).join(", ") || "-"} | Permissions: ${policyFound.permissions?.map(p => p.name).join(", ") || "-"}`
                            : policyId,
                    };
                }) || []
            );
        } else {
            // Legacy: clear policies
            setSelectedPolicies([]);
        }
        setEditVisible(true);
    }

    const onTypeChange = (value) => {
        setResource([]);
        setType(value);
        value.value === "User" ? getUsers() : getGroups();
    };

    function getUsers() {
        setUserStatus("loading");
        fetchUsers().then((data) => {
            setUsers(data);
            setUserStatus("finished");
        });
    }

    function getGroups() {
        setGroupStatus("loading");
        fetchIdCGroups().then((data) => {
            setGroups(data);
            setGroupStatus("finished");
        });
    }

    function getOUs() {
        setOUStatus("loading");
        fetchOUs().then(() => {
            const subscription = API.graphql(
                graphqlOperation(onPublishOUs)
            ).subscribe({
                next: (result) => {
                    const data = result.value.data.onPublishOUs.ous
                    setOUs(JSON.parse(data));
                    setOUStatus("finished");
                    subscription.unsubscribe();
                },
            });
        });
    }

    function getAccounts() {
        setAccountStatus("loading");
        fetchAccounts().then((data) => {
            setAccounts(data);
            setAccountStatus("finished");
        });
    }

    function getPermissions() {
        setPermissionStatus("loading");
        fetchPermissions().then((data) => {
            const subscription = API.graphql(
                graphqlOperation(onPublishPermissions)
            ).subscribe({
                next: (result) => {
                    if (result.value.data.onPublishPermissions.id === data.id) {
                        setPermissions(result.value.data.onPublishPermissions.permissions);
                        setPermissionStatus("finished");
                        subscription.unsubscribe();
                    }
                },
            });
        });
    }

    const onResourceChange = (value) => {
        setResource(value);
    };

    async function validate(action) {
        let valid = true;

        // Prevent creating new legacy eligibility when disabled (only for new entries, not edits)
        if (action === "submit" && eligibilityMode === EligibilityMode.LEGACY && !allowLegacyEligibility) {
            setResourceError("Legacy eligibility creation is disabled. Use policy-based eligibility or enable legacy mode in Settings.");
            return false;
        }

        // Common validations
        if ((!ticketNo && ticketRequired) || !(/^[a-zA-Z0-9]+$/.test(ticketNo[0]))) {
            setTicketError("Enter valid change management ticket number");
            valid = false;
        }
        if (!resource && action === "submit") {
            setResourceError("Select a valid entity");
            valid = false;
        }
        if (!Type && action === "submit") {
            setTypeError("Select a valid entity type");
            valid = false;
        }

        // Mode-specific validations
        if (eligibilityMode === EligibilityMode.POLICY_BASED) {
            // Policy-based mode: only policies are required
            if (selectedPolicies.length < 1) {
                valid = false;
                setPoliciesError("Select at least one policy");
            }
        } else {
            // Legacy mode: accounts/OUs and permissions are required
            if (permission.length < 1) {
                valid = false;
                setPermissionError("Select permission set");
            }
            if (ou.length < 1 && account.length < 1) {
                valid = false;
                setOuError("Select OUs and/or Accounts");
                setAccountError("Select OUs and/or Accounts");
            }
            if (!duration || isNaN(duration) || Number(duration) > 8000 || Number(duration) < 1) {
                setDurationError(`Enter number between 1-8000`);
                valid = false;
            }
        }

        // Check for conflicts between legacy and policy-based eligibility
        if (action === "submit" && resource && resource.length > 0) {
            for (const selectedResource of resource) {
                const existingEligibility = rawEligibilities.find(e => e.id === selectedResource.value);
                if (existingEligibility) {
                    const isExistingLegacy = !existingEligibility.policyIds || existingEligibility.policyIds.length === 0;
                    const isNewLegacy = eligibilityMode === EligibilityMode.LEGACY;

                    if (isExistingLegacy && !isNewLegacy) {
                        valid = false;
                        setResourceError(`"${selectedResource.label}" already has a legacy eligibility. Delete it first to create policy-based.`);
                        break;
                    } else if (!isExistingLegacy && isNewLegacy) {
                        valid = false;
                        setResourceError(`"${selectedResource.label}" already has a policy-based eligibility. Delete it first to create legacy.`);
                        break;
                    } else if (isExistingLegacy && isNewLegacy) {
                        valid = false;
                        setResourceError(`"${selectedResource.label}" already has a legacy eligibility. Use Edit to modify it.`);
                        break;
                    } else {
                        // Both policy-based - could allow adding more policies via Edit
                        valid = false;
                        setResourceError(`"${selectedResource.label}" already has a policy-based eligibility. Use Edit to add more policies.`);
                        break;
                    }
                }
            }
        }

        return valid;
    }

    function handleSubmit(event) {
        let action = "submit";
        setSubmitLoading(true);
        validate(action).then((valid) => {
            if (valid) {
                event.preventDefault();
                resource.forEach((item) => {
                    let data;
                    if (eligibilityMode === EligibilityMode.POLICY_BASED) {
                        // Policy-based mode: only store policyIds, other fields come from policy
                        data = {
                            type: Type.value,
                            name: item.label,
                            id: item.value,
                            ticketNo: ticketNo,
                            policyIds: selectedPolicies.map(({value}) => value),
                            // Clear legacy fields
                            accounts: [],
                            permissions: [],
                            ous: [],
                            approvalRequired: false,
                            duration: "0"
                        };
                    } else {
                        // Legacy mode: store all fields directly
                        data = {
                            type: Type.value,
                            name: item.label,
                            accounts: account.map(({value, label}) => ({name: label, id: value})),
                            permissions: permission.map(({value, label}) => ({name: label, id: value})),
                            ous: ou.map(({value, label}) => ({name: label, id: value})),
                            policyIds: [],
                            id: item.value,
                            ticketNo: ticketNo,
                            approvalRequired: approvalRequired,
                            duration: duration
                        };
                    }
                    addPolicy(data)
                        .then(() => {
                            views();
                            props.addNotification([
                                {
                                    type: "success",
                                    content: "Eligibility policy added successfully",
                                    dismissible: true,
                                    onDismiss: () => props.addNotification([]),
                                },
                            ]);
                        })
                        .catch((err) => {
                            setSubmitLoading(false);
                            const errorMessage = err?.errors?.[0]?.message || "Failed to add eligibility policy";
                            props.addNotification([
                                {
                                    type: "error",
                                    content: errorMessage,
                                    dismissible: true,
                                    onDismiss: () => props.addNotification([]),
                                },
                            ]);
                        });
                });
            } else {
                setSubmitLoading(false);
            }
        });
    }

    function handleDismiss() {
        setVisible(false);
        setDeleteVisible(false);
        setEditVisible(false);
        setType("");
        setTypeError("");
        setResource("");
        setResourceError("");
        setAccount([]);
        setAccountError("");
        setOU([]);
        setOuError("");
        setPermission([]);
        setPermissionError("");
        setSelectedPolicies([]);
        setPoliciesError("");
        setTicketNo("");
        setTicketError("");
        setEligibilityMode(DEFAULT_ELIGIBILITY_MODE);
        setDurationError("");
    }

    const ValueWithLabel = ({label, children}) => (
        <div>
            <Box variant="awsui-key-label">{label}</Box>
            <div>{children}</div>
        </div>
    );


    return (
        <div className="container">
            <Table
                {...collectionProps}
                resizableColumns="true"
                loading={tableLoading}
                loadingText="Fetching eligibility policy"
                wrapLines
                header={
                    <Header
                        counter={
                            selectedItems.length
                                ? `(${selectedItems.length}/${allItems.length})`
                                : `(${allItems.length})`
                        }
                        actions={
                            <SpaceBetween size="s" direction="horizontal">
                                <Button
                                    iconName="refresh"
                                    onClick={handleRefresh}
                                    loading={refreshLoading}
                                />
                                <ButtonDropdown
                                    items={[
                                        {
                                            text: "Edit",
                                            id: "edit",
                                            disabled:
                                                selectedItems.length === 0 || selectedItems.length > 1,
                                        },
                                        {
                                            text: "Delete",
                                            id: "delete",
                                            disabled: selectedItems.length === 0,
                                        },
                                    ]}
                                    onItemClick={(props) => handleSelect(props)}
                                >
                                    Actions
                                </ButtonDropdown>
                                <Button variant="primary" onClick={handleAdd}>
                                    Add policy
                                </Button>
                            </SpaceBetween>
                        }
                    >
                        Eligibility groups
                    </Header>
                }
                filter={
                    <div className="input-container">
                        <TextFilter
                            {...filterProps}
                            filteringPlaceholder="Find policy"
                            countText={filteredItemsCount}
                            className="input-filter"
                        />
                        <Select
                            {...filterProps}
                            className="select-filter engine-filter"
                            selectedAriaLabel="Selected"
                            options={selectTypeOptions}
                            selectedOption={selectedOption}
                            onChange={({detail}) =>
                                setSelectedOption(detail.selectedOption)
                            }
                            ariaDescribedby={null}
                        />
                    </div>
                }
                columnDefinitions={COLUMN_DEFINITIONS}
                visibleColumns={preferences.visibleContent}
                pagination={<Pagination {...paginationProps} />}
                preferences={
                    <MyCollectionPreferences
                        preferences={preferences}
                        setPreferences={setPreferences}
                    />
                }
                items={items}
                selectionType="multi"
            />
            <Modal
                onDismiss={() => handleDismiss()}
                visible={visible}
                closeAriaLabel="Close modal"
                size="large"
                header="Policy"
            >
                <Form
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button
                                variant="primary"
                                type="submit"
                                onClick={handleSubmit}
                                className="buttons"
                            >
                                Add eligibility policy
                            </Button>
                        </SpaceBetween>
                    }
                >
                    <SpaceBetween direction="vertical" size="l">
                        <FormField
                            label="Entity type"
                            stretch
                            description="User or Group"
                            errorText={typeError}
                        >
                            <Select
                                selectedAriaLabel="Selected"
                                options={[
                                    {
                                        label: "User",
                                        value: "User",
                                    },
                                    {
                                        label: "Group",
                                        value: "Group",
                                    },
                                ]}
                                selectedOption={Type}
                                onChange={(event) => {
                                    setTypeError();
                                    onTypeChange(event.detail.selectedOption);
                                }}
                            />
                        </FormField>
                        {Type.value === "User" && (
                            <FormField
                                label="User"
                                stretch
                                description="User eligibility policy"
                                errorText={resourceError}
                            >
                                <Multiselect
                                    statusType={userStatus}
                                    placeholder="Select Users"
                                    loadingText="Loading users"
                                    filteringType="auto"
                                    empty="No options"
                                    options={users.map((user) => ({
                                        label: user.UserName,
                                        value: user.UserId,
                                        description: user.UserId,
                                    }))}
                                    selectedOptions={resource}
                                    onChange={(event) => {
                                        setResourceError();
                                        onResourceChange(event.detail.selectedOptions);
                                    }}
                                    selectedAriaLabel="selected"
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                />
                            </FormField>
                        )}
                        {Type.value === "Group" && (
                            <FormField
                                label="Group"
                                stretch
                                description="Group eligibility policy"
                                errorText={resourceError}
                            >
                                <Multiselect
                                    statusType={groupStatus}
                                    placeholder="Select Groups"
                                    loadingText="Loading Groups"
                                    filteringType="auto"
                                    empty="No options"
                                    options={groups.map((group) => ({
                                        label: group.DisplayName,
                                        value: group.GroupId,
                                        description: group.GroupId,
                                    }))}
                                    selectedOptions={resource}
                                    onChange={(event) => {
                                        setResourceError();
                                        onResourceChange(event.detail.selectedOptions);
                                    }}
                                    selectedAriaLabel="selected"
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                />
                            </FormField>
                        )}
                        <FormField
                            label="Ticket No"
                            stretch
                            description="Change Management system ticket system number"
                            errorText={ticketError}
                        >
                            <Input
                                value={ticketNo}
                                onChange={(event) => {
                                    setTicketError();
                                    setTicketNo(event.detail.value);
                                }}
                            />
                        </FormField>
                        <FormField
                            label="Eligibility mode"
                            stretch
                            description={allowLegacyEligibility
                                ? "Choose how to define access permissions"
                                : "Legacy mode is disabled. To enable it, change the setting in Settings."
                            }
                        >
                            <RadioGroup
                                onChange={({detail}) => {
                                    setEligibilityMode(detail.value);
                                    // Clear errors when switching modes
                                    setPoliciesError("");
                                    setAccountError("");
                                    setOuError("");
                                    setPermissionError("");
                                    setDurationError("");
                                }}
                                value={eligibilityMode}
                                items={ELIGIBILITY_MODE_OPTIONS.map(opt => ({
                                    ...opt,
                                    disabled: opt.value === EligibilityMode.LEGACY && !allowLegacyEligibility
                                }))}
                            />
                        </FormField>
                        {eligibilityMode === EligibilityMode.POLICY_BASED && (
                            <FormField
                                label="Policies"
                                stretch
                                description="The policies that user can request elevated access from."
                                errorText={policiesError}
                            >
                                <SpaceBetween direction="vertical" size="xs">
                                    <Grid gridDefinition={[{ colspan: 11 }, { colspan: 1 }]}>
                                        <Multiselect
                                            statusType={policiesStatus}
                                            placeholder="Select policies"
                                            loadingText="Loading policies"
                                            filteringType="auto"
                                            empty="No policies available"
                                            options={policies.map((policy) => ({
                                                label: policy.id,
                                                value: policy.id,
                                                description: `Accounts: ${policy.resolvedAccounts?.map(a => a.name).join(", ") || "-"} | Permissions: ${policy.permissions?.map(p => p.name).join(", ") || "-"}`,
                                            }))}
                                            selectedOptions={selectedPolicies}
                                            onChange={({detail}) => {
                                                setPoliciesError("");
                                                setSelectedPolicies(detail.selectedOptions);
                                            }}
                                            selectedAriaLabel="selected"
                                            deselectAriaLabel={(e) => `Remove ${e.label}`}
                                        />
                                        <Button
                                            iconName="refresh"
                                            onClick={refreshPolicies}
                                            loading={policiesStatus === "loading"}
                                        />
                                    </Grid>
                                    <Button
                                        iconName="external"
                                        iconAlign="right"
                                        variant="link"
                                        onClick={() => window.open("/admin/policies", "_blank")}
                                    >
                                        Create new policy
                                    </Button>
                                </SpaceBetween>
                            </FormField>
                        )}

                        {eligibilityMode === EligibilityMode.LEGACY && (
                        <>
                        <FormField
                            label="Accounts"
                            stretch
                            description="List of Eligible Accounts"
                            errorText={accountError}
                        >
                            <Multiselect
                                statusType={accountStatus}
                                placeholder="Select accounts"
                                loadingText="Loading accounts"
                                filteringType="auto"
                                empty="No options"
                                options={accounts.map((account) => ({
                                    label: account.name,
                                    value: account.id,
                                    description: account.id,
                                }))}
                                selectedOptions={account}
                                onChange={({detail}) => {
                                    setAccountError("");
                                    setAccount(detail.selectedOptions);
                                }}
                                selectedAriaLabel="selected"
                                deselectAriaLabel={(e) => `Remove ${e.label}`}
                            />
                        </FormField>
                        <FormField
                            label="OUs"
                            stretch
                            description="List of Eligible OUs"
                            errorText={ouError}
                        >
                            {ous.length === 1 ? (<Ous
                                options={ous}
                                setResource={setOU}
                                resource={ou}
                            />) : <Spinner size="large"/>}

                            {/* <Multiselect
                statusType={ouStatus}
                placeholder="Select OUs"
                loadingText="Loading OUs"
                filteringType="auto"
                empty="No options"
                options={ous.map((ou) => ({
                  label: ou.Name,
                  value: ou.Id,
                  description: ou.Id,
                }))}
                selectedOptions={ou}
                onChange={({ detail }) => {
                  setOuError();
                  setOU(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              /> */}
                        </FormField>
                        <FormField
                            label="Permission"
                            stretch
                            description="List of Eligible Permissions"
                            errorText={permissionError}
                        >
                            <Multiselect
                                statusType={permissionStatus}
                                placeholder="Select Permissions"
                                loadingText="Loading Permissions"
                                filteringType="auto"
                                empty="No options"
                                options={permissions.map((permission) => ({
                                    label: permission.Name,
                                    value: permission.Arn,
                                    description: permission.Arn,
                                }))}
                                selectedOptions={permission}
                                onChange={({detail}) => {
                                    setPermissionError();
                                    setPermission(detail.selectedOptions);
                                }}
                                selectedAriaLabel="selected"
                                deselectAriaLabel={(e) => `Remove ${e.label}`}
                            />
                        </FormField>
                        <FormField
                            label="Max duration"
                            stretch
                            description="Maximum elevated access request duration in hours"
                            errorText={durationError}
                            placeholder={`Enter number between 1-8000`}
                        >
                            <Input
                                value={duration}
                                onChange={(event) => {
                                    setDurationError();
                                    event.detail.value > 8000
                                        ? setDurationError(
                                            `Enter a number between 1 and 8000`
                                        )
                                        : setDuration(event.detail.value);
                                }}
                                type="number"
                            />
                        </FormField>
                        <FormField
                            label="Approval required"
                            stretch
                            description="Determines if approval is required for elevated access"
                        >
                            <Toggle
                                onChange={({detail}) => setApprovalRequired(detail.checked)}
                                checked={approvalRequired}
                            >
                                Approval required
                            </Toggle>
                        </FormField>
                        </>
                        )}
                    </SpaceBetween>
                </Form>
            </Modal>
            <Modal
                onDismiss={() => setDeleteVisible(false)}
                visible={deleteVisible}
                closeAriaLabel="Close modal"
                size="medium"
                footer={
                    <Box float="right">
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button
                                variant="link"
                                onClick={() => {
                                    setDeleteVisible(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDelete}
                                loading={confirmLoading}
                            >
                                Confirm
                            </Button>
                        </SpaceBetween>
                    </Box>
                }
                header="Delete eligibility policy"
            >
                Are you sure you want to delete policy ?
            </Modal>
            {selectedItems.length > 0 && (
                <Modal
                    onDismiss={() => handleDismiss()}
                    visible={editVisible}
                    closeAriaLabel="Close modal"
                    size="large"
                    footer={
                        <Box float="right">
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button
                                    variant="link"
                                    onClick={() => {
                                        handleDismiss();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleConfirmEdit}
                                    loading={confirmLoading}
                                >
                                    Confirm
                                </Button>
                            </SpaceBetween>
                        </Box>
                    }
                    header="Edit policy"
                >
                    <SpaceBetween size="l">
                        <ColumnLayout columns={3} variant="text-grid">
                            <ValueWithLabel label="Entity type">
                                {selectedItems[0].type}
                            </ValueWithLabel>
                            <ValueWithLabel label="Name">
                                {selectedItems[0].name}
                            </ValueWithLabel>
                            <ValueWithLabel label="Id">{selectedItems[0].id}</ValueWithLabel>
                        </ColumnLayout>
                        <FormField
                            label="Ticket No"
                            stretch
                            description="Change Management system ticket system number"
                            errorText={ticketError}
                        >
                            <Input
                                value={ticketNo}
                                onChange={(event) => {
                                    setTicketError();
                                    setTicketNo(event.detail.value);
                                }}
                            />
                        </FormField>
                        {eligibilityMode === EligibilityMode.POLICY_BASED && (
                            <FormField
                                label="Policies"
                                stretch
                                description="The policies that user can request elevated access from."
                                errorText={policiesError}
                            >
                                <SpaceBetween direction="vertical" size="xs">
                                    <Grid gridDefinition={[{ colspan: 11 }, { colspan: 1 }]}>
                                        <Multiselect
                                            statusType={policiesStatus}
                                            placeholder="Select policies"
                                            loadingText="Loading policies"
                                            filteringType="auto"
                                            empty="No policies available"
                                            options={policies.map((policy) => ({
                                                label: policy.id,
                                                value: policy.id,
                                                description: `Accounts: ${policy.resolvedAccounts?.map(a => a.name).join(", ") || "-"} | Permissions: ${policy.permissions?.map(p => p.name).join(", ") || "-"}`,
                                            }))}
                                            selectedOptions={selectedPolicies}
                                            onChange={({detail}) => {
                                                setPoliciesError("");
                                                setSelectedPolicies(detail.selectedOptions);
                                            }}
                                            selectedAriaLabel="selected"
                                            deselectAriaLabel={(e) => `Remove ${e.label}`}
                                        />
                                        <Button
                                            iconName="refresh"
                                            onClick={refreshPolicies}
                                            loading={policiesStatus === "loading"}
                                        />
                                    </Grid>
                                    <Button
                                        iconName="external"
                                        iconAlign="right"
                                        variant="link"
                                        onClick={() => window.open("/admin/policies", "_blank")}
                                    >
                                        Create new policy
                                    </Button>
                                </SpaceBetween>
                            </FormField>
                        )}
                        {eligibilityMode === EligibilityMode.LEGACY && (
                        <>
                            <FormField
                                label="Account"
                                stretch
                                description="List of Eligible Accounts"
                                errorText={accountError}
                            >
                                <Multiselect
                                    statusType={accountStatus}
                                    placeholder="Select accounts"
                                    loadingText="Loading accounts"
                                    filteringType="auto"
                                    empty="No options"
                                    options={accounts.map((account) => ({
                                        label: account.name,
                                        value: account.id,
                                        description: account.id,
                                    }))}
                                    selectedOptions={account}
                                    onChange={({detail}) => {
                                        setAccountError();
                                        setAccount(detail.selectedOptions);
                                    }}
                                    selectedAriaLabel="selected"
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                />
                            </FormField>
                            <FormField
                                label="OU"
                                stretch
                                description="List of Eligible OUs"
                                errorText={ouError}
                            >
                                {ous.length === 1 ? (<Ous
                                    options={ous}
                                    setResource={setOU}
                                    resource={ou}
                                />) : <Spinner size="large"/>}
                            </FormField>
                            <FormField
                                label="Permission"
                                stretch
                                description="List of Eligible Permissions"
                                errorText={permissionError}
                            >
                                <Multiselect
                                    statusType={permissionStatus}
                                    placeholder="Select Permissions"
                                    loadingText="Loading Permissions"
                                    filteringType="auto"
                                    empty="No options"
                                    options={permissions.map((permission) => ({
                                        label: permission.Name,
                                        value: permission.Arn,
                                        description: permission.Arn,
                                    }))}
                                    selectedOptions={permission}
                                    onChange={({detail}) => {
                                        setPermissionError();
                                        setPermission(detail.selectedOptions);
                                    }}
                                    selectedAriaLabel="selected"
                                    deselectAriaLabel={(e) => `Remove ${e.label}`}
                                />
                            </FormField>
                            <FormField
                                label="Max duration"
                                stretch
                                description="Maximum elevated access request duration in hours"
                                errorText={durationError}
                                placeholder={`Enter number between 1-8000`}
                            >
                                <Input
                                    value={duration}
                                    onChange={(event) => {
                                        setDurationError();
                                        event.detail.value > 8000
                                            ? setDurationError(
                                                `Enter a number between 1 and 8000`
                                            )
                                            : setDuration(event.detail.value);
                                    }}
                                    type="number"
                                />
                            </FormField>
                            <FormField
                                label="Approval required"
                                stretch
                                description="Determines if approval is required for elevated access"
                            >
                                <Toggle
                                    onChange={({detail}) => setApprovalRequired(detail.checked)}
                                    checked={approvalRequired}
                                >
                                    Approval required
                                </Toggle>
                            </FormField>
                        </>
                        )}
                    </SpaceBetween>
                </Modal>
            )}
        </div>
    );
}

export default Eligible;
