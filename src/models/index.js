// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { requests, sessions, Approvers, Eligibility, Accounts, OUs, OU, Permissions, Groups, IdCGroups, Users, Logs, Entitlement, data, Members } = initSchema(schema);

export {
  requests,
  sessions,
  Approvers,
  Eligibility,
  Accounts,
  OUs,
  OU,
  Permissions,
  Groups,
  IdCGroups,
  Users,
  Logs,
  Entitlement,
  data,
  Members
};