import { ModelInit, MutableModel } from "@aws-amplify/datastore";
// @ts-ignore
import { LazyLoading, LazyLoadingDisabled } from "@aws-amplify/datastore";

type EagerAccounts = {
  readonly name: string;
  readonly id: string;
}

type LazyAccounts = {
  readonly name: string;
  readonly id: string;
}

export declare type Accounts = LazyLoading extends LazyLoadingDisabled ? EagerAccounts : LazyAccounts

export declare const Accounts: (new (init: ModelInit<Accounts>) => Accounts)

type EagerOUs = {
  readonly Id: string;
  readonly Arn: string;
  readonly Name: string;
}

type LazyOUs = {
  readonly Id: string;
  readonly Arn: string;
  readonly Name: string;
}

export declare type OUs = LazyLoading extends LazyLoadingDisabled ? EagerOUs : LazyOUs

export declare const OUs: (new (init: ModelInit<OUs>) => OUs)

type EagerOU = {
  readonly Id: string;
}

type LazyOU = {
  readonly Id: string;
}

export declare type OU = LazyLoading extends LazyLoadingDisabled ? EagerOU : LazyOU

export declare const OU: (new (init: ModelInit<OU>) => OU)

type EagerPermissions = {
  readonly Name: string;
  readonly Arn: string;
}

type LazyPermissions = {
  readonly Name: string;
  readonly Arn: string;
}

export declare type Permissions = LazyLoading extends LazyLoadingDisabled ? EagerPermissions : LazyPermissions

export declare const Permissions: (new (init: ModelInit<Permissions>) => Permissions)

type EagerGroups = {
  readonly groups?: (string | null)[] | null;
  readonly userId?: string | null;
  readonly groupIds?: (string | null)[] | null;
}

type LazyGroups = {
  readonly groups?: (string | null)[] | null;
  readonly userId?: string | null;
  readonly groupIds?: (string | null)[] | null;
}

export declare type Groups = LazyLoading extends LazyLoadingDisabled ? EagerGroups : LazyGroups

export declare const Groups: (new (init: ModelInit<Groups>) => Groups)

type EagerIdCGroups = {
  readonly GroupId: string;
  readonly DisplayName: string;
}

type LazyIdCGroups = {
  readonly GroupId: string;
  readonly DisplayName: string;
}

export declare type IdCGroups = LazyLoading extends LazyLoadingDisabled ? EagerIdCGroups : LazyIdCGroups

export declare const IdCGroups: (new (init: ModelInit<IdCGroups>) => IdCGroups)

type EagerUsers = {
  readonly UserName: string;
  readonly UserId: string;
}

type LazyUsers = {
  readonly UserName: string;
  readonly UserId: string;
}

export declare type Users = LazyLoading extends LazyLoadingDisabled ? EagerUsers : LazyUsers

export declare const Users: (new (init: ModelInit<Users>) => Users)

type EagerLogs = {
  readonly eventName?: string | null;
  readonly eventSource?: string | null;
  readonly eventID?: string | null;
  readonly eventTime?: string | null;
}

type LazyLogs = {
  readonly eventName?: string | null;
  readonly eventSource?: string | null;
  readonly eventID?: string | null;
  readonly eventTime?: string | null;
}

export declare type Logs = LazyLoading extends LazyLoadingDisabled ? EagerLogs : LazyLogs

export declare const Logs: (new (init: ModelInit<Logs>) => Logs)

type EagerEntitlement = {
  readonly accounts?: (data | null)[] | null;
  readonly permissions?: (data | null)[] | null;
}

type LazyEntitlement = {
  readonly accounts?: (data | null)[] | null;
  readonly permissions?: (data | null)[] | null;
}

export declare type Entitlement = LazyLoading extends LazyLoadingDisabled ? EagerEntitlement : LazyEntitlement

export declare const Entitlement: (new (init: ModelInit<Entitlement>) => Entitlement)

type Eagerdata = {
  readonly name?: string | null;
  readonly id?: string | null;
}

type Lazydata = {
  readonly name?: string | null;
  readonly id?: string | null;
}

export declare type data = LazyLoading extends LazyLoadingDisabled ? Eagerdata : Lazydata

export declare const data: (new (init: ModelInit<data>) => data)

type EagerMembers = {
  readonly members?: (string | null)[] | null;
}

type LazyMembers = {
  readonly members?: (string | null)[] | null;
}

export declare type Members = LazyLoading extends LazyLoadingDisabled ? EagerMembers : LazyMembers

export declare const Members: (new (init: ModelInit<Members>) => Members)

type requestsMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type sessionsMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type ApproversMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type EligibilityMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type Eagerrequests = {
  readonly id: string;
  readonly email?: string | null;
  readonly accountId: string;
  readonly accountName: string;
  readonly role: string;
  readonly roleId: string;
  readonly startTime: string;
  readonly duration: string;
  readonly justification?: string | null;
  readonly status?: string | null;
  readonly comment?: string | null;
  readonly approver?: string | null;
  readonly approvers?: (string | null)[] | null;
  readonly approver_ids?: (string | null)[] | null;
  readonly revoker?: string | null;
  readonly endTime?: string | null;
  readonly ticketNo?: string | null;
  readonly revokeComment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type Lazyrequests = {
  readonly id: string;
  readonly email?: string | null;
  readonly accountId: string;
  readonly accountName: string;
  readonly role: string;
  readonly roleId: string;
  readonly startTime: string;
  readonly duration: string;
  readonly justification?: string | null;
  readonly status?: string | null;
  readonly comment?: string | null;
  readonly approver?: string | null;
  readonly approvers?: (string | null)[] | null;
  readonly approver_ids?: (string | null)[] | null;
  readonly revoker?: string | null;
  readonly endTime?: string | null;
  readonly ticketNo?: string | null;
  readonly revokeComment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type requests = LazyLoading extends LazyLoadingDisabled ? Eagerrequests : Lazyrequests

export declare const requests: (new (init: ModelInit<requests, requestsMetaData>) => requests) & {
  copyOf(source: requests, mutator: (draft: MutableModel<requests, requestsMetaData>) => MutableModel<requests, requestsMetaData> | void): requests;
}

type Eagersessions = {
  readonly id: string;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly username?: string | null;
  readonly accountId?: string | null;
  readonly role?: string | null;
  readonly approver_ids?: (string | null)[] | null;
  readonly queryId?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type Lazysessions = {
  readonly id: string;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly username?: string | null;
  readonly accountId?: string | null;
  readonly role?: string | null;
  readonly approver_ids?: (string | null)[] | null;
  readonly queryId?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type sessions = LazyLoading extends LazyLoadingDisabled ? Eagersessions : Lazysessions

export declare const sessions: (new (init: ModelInit<sessions, sessionsMetaData>) => sessions) & {
  copyOf(source: sessions, mutator: (draft: MutableModel<sessions, sessionsMetaData>) => MutableModel<sessions, sessionsMetaData> | void): sessions;
}

type EagerApprovers = {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly approvers?: (string | null)[] | null;
  readonly groupIds?: (string | null)[] | null;
  readonly ticketNo?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyApprovers = {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly approvers?: (string | null)[] | null;
  readonly groupIds?: (string | null)[] | null;
  readonly ticketNo?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Approvers = LazyLoading extends LazyLoadingDisabled ? EagerApprovers : LazyApprovers

export declare const Approvers: (new (init: ModelInit<Approvers, ApproversMetaData>) => Approvers) & {
  copyOf(source: Approvers, mutator: (draft: MutableModel<Approvers, ApproversMetaData>) => MutableModel<Approvers, ApproversMetaData> | void): Approvers;
}

type EagerEligibility = {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly accounts?: (data | null)[] | null;
  readonly ous?: (data | null)[] | null;
  readonly permissions?: (data | null)[] | null;
  readonly ticketNo?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyEligibility = {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly accounts?: (data | null)[] | null;
  readonly ous?: (data | null)[] | null;
  readonly permissions?: (data | null)[] | null;
  readonly ticketNo?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Eligibility = LazyLoading extends LazyLoadingDisabled ? EagerEligibility : LazyEligibility

export declare const Eligibility: (new (init: ModelInit<Eligibility, EligibilityMetaData>) => Eligibility) & {
  copyOf(source: Eligibility, mutator: (draft: MutableModel<Eligibility, EligibilityMetaData>) => MutableModel<Eligibility, EligibilityMetaData> | void): Eligibility;
}