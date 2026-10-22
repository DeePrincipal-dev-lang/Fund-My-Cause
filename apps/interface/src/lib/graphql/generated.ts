/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
import { GraphQLClient, type RequestOptions } from "graphql-request";
import gql from "graphql-tag";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  BigInt: { input: string; output: string };
};

export type AuthPayload = {
  __typename?: "AuthPayload";
  token: Scalars["String"]["output"];
  user: User;
};

export type Campaign = {
  __typename?: "Campaign";
  category: Scalars["String"]["output"];
  contractId: Scalars["String"]["output"];
  createdAt: Scalars["String"]["output"];
  creator: Scalars["String"]["output"];
  daysRemaining: Scalars["Int"]["output"];
  deadline: Scalars["String"]["output"];
  description: Scalars["String"]["output"];
  goal: Scalars["BigInt"]["output"];
  hasRBACEnabled: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  image?: Maybe<Scalars["String"]["output"]>;
  minContribution: Scalars["BigInt"]["output"];
  percentageFunded: Scalars["Float"]["output"];
  platformFeeBps?: Maybe<Scalars["Int"]["output"]>;
  raised: Scalars["BigInt"]["output"];
  status: CampaignStatus;
  title: Scalars["String"]["output"];
  token: Scalars["String"]["output"];
  totalContributors: Scalars["Int"]["output"];
  totalRaised: Scalars["BigInt"]["output"];
  updatedAt: Scalars["String"]["output"];
  videoUrl?: Maybe<Scalars["String"]["output"]>;
};

export type CampaignConnection = {
  __typename?: "CampaignConnection";
  edges: Array<CampaignEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type CampaignDetail = {
  __typename?: "CampaignDetail";
  campaign: Campaign;
  contributors: Array<Contributor>;
  milestones: Array<Milestone>;
  topContributors: Array<TopContributor>;
  updates: Array<CampaignUpdate>;
};

export type CampaignDetailTopContributorsArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
};

export type CampaignEdge = {
  __typename?: "CampaignEdge";
  cursor: Scalars["String"]["output"];
  node: Campaign;
};

export type CampaignFilter = {
  category?: InputMaybe<Array<Scalars["String"]["input"]>>;
  creator?: InputMaybe<Scalars["String"]["input"]>;
  maxGoal?: InputMaybe<Scalars["BigInt"]["input"]>;
  minGoal?: InputMaybe<Scalars["BigInt"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<Array<CampaignStatus>>;
};

export type CampaignProgress = {
  __typename?: "CampaignProgress";
  campaignId: Scalars["ID"]["output"];
  contributors: Scalars["Int"]["output"];
  daysRemaining: Scalars["Int"]["output"];
  percentageFunded: Scalars["Float"]["output"];
  raised: Scalars["BigInt"]["output"];
  timestamp: Scalars["String"]["output"];
};

export type CampaignSort = {
  direction: SortDirection;
  field: SortField;
};

export enum CampaignStatus {
  Active = "ACTIVE",
  Archived = "ARCHIVED",
  Cancelled = "CANCELLED",
  Paused = "PAUSED",
  Refunded = "REFUNDED",
  Successful = "SUCCESSFUL",
}

export type CampaignUpdate = {
  __typename?: "CampaignUpdate";
  campaignId: Scalars["ID"]["output"];
  content: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  ipfsHash: Scalars["String"]["output"];
  timestamp: Scalars["String"]["output"];
};

export type Contribution = {
  __typename?: "Contribution";
  amount: Scalars["BigInt"]["output"];
  campaignId: Scalars["ID"]["output"];
  contributor: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  timestamp: Scalars["String"]["output"];
  transactionHash: Scalars["String"]["output"];
};

export type Contributor = {
  __typename?: "Contributor";
  address: Scalars["String"]["output"];
  amount: Scalars["BigInt"]["output"];
  contributionCount: Scalars["Int"]["output"];
  isTopContributor: Scalars["Boolean"]["output"];
};

export type CreateCampaignInput = {
  category: Scalars["String"]["input"];
  deadline: Scalars["String"]["input"];
  description: Scalars["String"]["input"];
  goal: Scalars["BigInt"]["input"];
  image?: InputMaybe<Scalars["String"]["input"]>;
  minContribution: Scalars["BigInt"]["input"];
  title: Scalars["String"]["input"];
  videoUrl?: InputMaybe<Scalars["String"]["input"]>;
};

export type Milestone = {
  __typename?: "Milestone";
  campaignId: Scalars["ID"]["output"];
  description: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  releasePercentage: Scalars["Int"]["output"];
  status: MilestoneStatus;
  targetAmount: Scalars["BigInt"]["output"];
  title: Scalars["String"]["output"];
};

export enum MilestoneStatus {
  Pending = "PENDING",
  Reached = "REACHED",
  Released = "RELEASED",
}

export type Mutation = {
  __typename?: "Mutation";
  authenticate: AuthPayload;
  createCampaign: Campaign;
  recordContribution: Contribution;
  updateCampaign: Campaign;
};

export type MutationAuthenticateArgs = {
  address: Scalars["String"]["input"];
  message: Scalars["String"]["input"];
  signature: Scalars["String"]["input"];
};

export type MutationCreateCampaignArgs = {
  input: CreateCampaignInput;
};

export type MutationRecordContributionArgs = {
  input: RecordContributionInput;
};

export type MutationUpdateCampaignArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateCampaignInput;
};

export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]["output"]>;
  hasNextPage: Scalars["Boolean"]["output"];
  hasPreviousPage: Scalars["Boolean"]["output"];
  startCursor?: Maybe<Scalars["String"]["output"]>;
};

export type PaginationInput = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
};

export type Query = {
  __typename?: "Query";
  activeCampaigns: Array<Campaign>;
  campaign?: Maybe<Campaign>;
  campaignDetail?: Maybe<CampaignDetail>;
  campaigns: CampaignConnection;
  contribution?: Maybe<Contribution>;
  contributions: Array<Contribution>;
  searchCampaigns: Array<Campaign>;
  stats: Statistics;
  trendingCampaigns: Array<Campaign>;
  user?: Maybe<User>;
  userContributions: Array<Contribution>;
};

export type QueryActiveCampaignsArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryCampaignArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryCampaignDetailArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryCampaignsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<CampaignFilter>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<CampaignSort>;
};

export type QueryContributionArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryContributionsArgs = {
  campaignId?: InputMaybe<Scalars["ID"]["input"]>;
  contributor?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySearchCampaignsArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  query: Scalars["String"]["input"];
};

export type QueryTrendingCampaignsArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryUserArgs = {
  address: Scalars["String"]["input"];
};

export type QueryUserContributionsArgs = {
  address: Scalars["String"]["input"];
  limit?: InputMaybe<Scalars["Int"]["input"]>;
};

export type RecordContributionInput = {
  amount: Scalars["BigInt"]["input"];
  campaignId: Scalars["ID"]["input"];
  contributor: Scalars["String"]["input"];
  transactionHash: Scalars["String"]["input"];
};

export enum SortDirection {
  Asc = "ASC",
  Desc = "DESC",
}

export enum SortField {
  Contributors = "CONTRIBUTORS",
  CreatedAt = "CREATED_AT",
  Deadline = "DEADLINE",
  Goal = "GOAL",
  RaisedAmount = "RAISED_AMOUNT",
}

export type Statistics = {
  __typename?: "Statistics";
  activeCampaigns: Scalars["Int"]["output"];
  averageContribution: Scalars["BigInt"]["output"];
  successRate: Scalars["Float"]["output"];
  totalCampaigns: Scalars["Int"]["output"];
  totalContributors: Scalars["Int"]["output"];
  totalRaised: Scalars["BigInt"]["output"];
};

export type Subscription = {
  __typename?: "Subscription";
  campaignProgressChanged: CampaignProgress;
  campaignStatusChanged: Campaign;
  campaignUpdated: CampaignUpdate;
  milestoneReached: Milestone;
  newContribution: Contribution;
};

export type SubscriptionCampaignProgressChangedArgs = {
  id: Scalars["ID"]["input"];
};

export type SubscriptionCampaignStatusChangedArgs = {
  id: Scalars["ID"]["input"];
};

export type SubscriptionCampaignUpdatedArgs = {
  id: Scalars["ID"]["input"];
};

export type SubscriptionMilestoneReachedArgs = {
  campaignId: Scalars["ID"]["input"];
};

export type SubscriptionNewContributionArgs = {
  campaignId: Scalars["ID"]["input"];
};

export type TopContributor = {
  __typename?: "TopContributor";
  address: Scalars["String"]["output"];
  amount: Scalars["BigInt"]["output"];
  percentage: Scalars["Float"]["output"];
  rank: Scalars["Int"]["output"];
};

export type UpdateCampaignInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  videoUrl?: InputMaybe<Scalars["String"]["input"]>;
};

export type User = {
  __typename?: "User";
  address: Scalars["String"]["output"];
  campaigns: Array<Campaign>;
  contributionCount: Scalars["Int"]["output"];
  contributions: Array<Contribution>;
  joinedAt: Scalars["String"]["output"];
  totalContributed: Scalars["BigInt"]["output"];
};

export type CampaignQueryVariables = Exact<{
  id: string | number;
}>;

export type CampaignQuery = {
  campaign: {
    id: string;
    contractId: string;
    title: string;
    description: string;
    creator: string;
    goal: string;
    raised: string;
    deadline: string;
    status: CampaignStatus;
    category: string;
    image: string | null;
    videoUrl: string | null;
    minContribution: string;
    totalRaised: string;
    totalContributors: number;
    percentageFunded: number;
    daysRemaining: number;
    token: string;
    platformFeeBps: number | null;
    hasRBACEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type CampaignDetailQueryVariables = Exact<{
  id: string | number;
}>;

export type CampaignDetailQuery = {
  campaignDetail: {
    campaign: {
      id: string;
      contractId: string;
      title: string;
      description: string;
      creator: string;
      goal: string;
      raised: string;
      deadline: string;
      status: CampaignStatus;
      category: string;
      image: string | null;
      videoUrl: string | null;
      minContribution: string;
      totalRaised: string;
      totalContributors: number;
      percentageFunded: number;
      daysRemaining: number;
      token: string;
      platformFeeBps: number | null;
      hasRBACEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    };
    contributors: Array<{
      address: string;
      amount: string;
      contributionCount: number;
      isTopContributor: boolean;
    }>;
    topContributors: Array<{
      rank: number;
      address: string;
      amount: string;
      percentage: number;
    }>;
    updates: Array<{ id: string; content: string; timestamp: string }>;
    milestones: Array<{
      id: string;
      title: string;
      description: string;
      targetAmount: string;
      releasePercentage: number;
      status: MilestoneStatus;
    }>;
  } | null;
};

export type CampaignsQueryVariables = Exact<{
  filter?: CampaignFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
  pagination?: PaginationInput | null | undefined;
  sort?: CampaignSort | null | undefined;
}>;

export type CampaignsQuery = {
  campaigns: {
    totalCount: number;
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        contractId: string;
        title: string;
        description: string;
        creator: string;
        goal: string;
        raised: string;
        deadline: string;
        status: CampaignStatus;
        category: string;
        image: string | null;
        videoUrl: string | null;
        minContribution: string;
        totalRaised: string;
        totalContributors: number;
        percentageFunded: number;
        daysRemaining: number;
        token: string;
        platformFeeBps: number | null;
        hasRBACEnabled: boolean;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export type ActiveCampaignsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;

export type ActiveCampaignsQuery = {
  activeCampaigns: Array<{
    id: string;
    contractId: string;
    title: string;
    description: string;
    creator: string;
    goal: string;
    raised: string;
    deadline: string;
    status: CampaignStatus;
    category: string;
    image: string | null;
    videoUrl: string | null;
    minContribution: string;
    totalRaised: string;
    totalContributors: number;
    percentageFunded: number;
    daysRemaining: number;
    token: string;
    platformFeeBps: number | null;
    hasRBACEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type ContributionsQueryVariables = Exact<{
  campaignId?: string | number | null | undefined;
  contributor?: string | null | undefined;
}>;

export type ContributionsQuery = {
  contributions: Array<{
    id: string;
    campaignId: string;
    contributor: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }>;
};

export type UserContributionsQueryVariables = Exact<{
  address: string;
  limit?: number | null | undefined;
}>;

export type UserContributionsQuery = {
  userContributions: Array<{
    id: string;
    campaignId: string;
    contributor: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }>;
};

export type UserQueryVariables = Exact<{
  address: string;
}>;

export type UserQuery = {
  user: {
    address: string;
    totalContributed: string;
    contributionCount: number;
    joinedAt: string;
  } | null;
};

export const CampaignDocument = gql`
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      contractId
      title
      description
      creator
      goal
      raised
      deadline
      status
      category
      image
      videoUrl
      minContribution
      totalRaised
      totalContributors
      percentageFunded
      daysRemaining
      token
      platformFeeBps
      hasRBACEnabled
      createdAt
      updatedAt
    }
  }
`;
export const CampaignDetailDocument = gql`
  query CampaignDetail($id: ID!) {
    campaignDetail(id: $id) {
      campaign {
        id
        contractId
        title
        description
        creator
        goal
        raised
        deadline
        status
        category
        image
        videoUrl
        minContribution
        totalRaised
        totalContributors
        percentageFunded
        daysRemaining
        token
        platformFeeBps
        hasRBACEnabled
        createdAt
        updatedAt
      }
      contributors {
        address
        amount
        contributionCount
        isTopContributor
      }
      topContributors(limit: 5) {
        rank
        address
        amount
        percentage
      }
      updates {
        id
        content
        timestamp
      }
      milestones {
        id
        title
        description
        targetAmount
        releasePercentage
        status
      }
    }
  }
`;
export const CampaignsDocument = gql`
  query Campaigns(
    $filter: CampaignFilter
    $first: Int
    $after: String
    $pagination: PaginationInput
    $sort: CampaignSort
  ) {
    campaigns(
      filter: $filter
      first: $first
      after: $after
      pagination: $pagination
      sort: $sort
    ) {
      edges {
        cursor
        node {
          id
          contractId
          title
          description
          creator
          goal
          raised
          deadline
          status
          category
          image
          videoUrl
          minContribution
          totalRaised
          totalContributors
          percentageFunded
          daysRemaining
          token
          platformFeeBps
          hasRBACEnabled
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
export const ActiveCampaignsDocument = gql`
  query ActiveCampaigns($limit: Int) {
    activeCampaigns(limit: $limit) {
      id
      contractId
      title
      description
      creator
      goal
      raised
      deadline
      status
      category
      image
      videoUrl
      minContribution
      totalRaised
      totalContributors
      percentageFunded
      daysRemaining
      token
      platformFeeBps
      hasRBACEnabled
      createdAt
      updatedAt
    }
  }
`;
export const ContributionsDocument = gql`
  query Contributions($campaignId: ID, $contributor: String) {
    contributions(campaignId: $campaignId, contributor: $contributor) {
      id
      campaignId
      contributor
      amount
      timestamp
      transactionHash
    }
  }
`;
export const UserContributionsDocument = gql`
  query UserContributions($address: String!, $limit: Int) {
    userContributions(address: $address, limit: $limit) {
      id
      campaignId
      contributor
      amount
      timestamp
      transactionHash
    }
  }
`;
export const UserDocument = gql`
  query User($address: String!) {
    user(address: $address) {
      address
      totalContributed
      contributionCount
      joinedAt
    }
  }
`;

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (
  action,
  _operationName,
  _operationType,
  _variables,
) => action();

export function getSdk(
  client: GraphQLClient,
  withWrapper: SdkFunctionWrapper = defaultWrapper,
) {
  return {
    Campaign(
      variables: CampaignQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CampaignQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CampaignQuery>({
            document: CampaignDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "Campaign",
        "query",
        variables,
      );
    },
    CampaignDetail(
      variables: CampaignDetailQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CampaignDetailQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CampaignDetailQuery>({
            document: CampaignDetailDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "CampaignDetail",
        "query",
        variables,
      );
    },
    Campaigns(
      variables?: CampaignsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CampaignsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CampaignsQuery>({
            document: CampaignsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "Campaigns",
        "query",
        variables,
      );
    },
    ActiveCampaigns(
      variables?: ActiveCampaignsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ActiveCampaignsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ActiveCampaignsQuery>({
            document: ActiveCampaignsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ActiveCampaigns",
        "query",
        variables,
      );
    },
    Contributions(
      variables?: ContributionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ContributionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ContributionsQuery>({
            document: ContributionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "Contributions",
        "query",
        variables,
      );
    },
    UserContributions(
      variables: UserContributionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UserContributionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UserContributionsQuery>({
            document: UserContributionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "UserContributions",
        "query",
        variables,
      );
    },
    User(
      variables: UserQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UserQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UserQuery>({
            document: UserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "User",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
