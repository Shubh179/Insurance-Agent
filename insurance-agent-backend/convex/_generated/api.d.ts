/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_environment from "../agent/environment.js";
import type * as agents_environmentAgent from "../agents/environmentAgent.js";
import type * as agents_insuranceAnalyzer from "../agents/insuranceAnalyzer.js";
import type * as auth_google from "../auth/google.js";
import type * as auth_oauth from "../auth/oauth.js";
import type * as auth_realoauth from "../auth/realoauth.js";
import type * as emails_filter from "../emails/filter.js";
import type * as endpoints_database from "../endpoints/database.js";
import type * as endpoints_health from "../endpoints/health.js";
import type * as gmail_debug from "../gmail/debug.js";
import type * as gmail_fetch from "../gmail/fetch.js";
import type * as gmail_fetch_get from "../gmail/fetch_get.js";
import type * as gmail_getemails from "../gmail/getemails.js";
import type * as gmail_sync from "../gmail/sync.js";
import type * as gmail_syncreal from "../gmail/syncreal.js";
import type * as http from "../http.js";
import type * as http_mcp_persona from "../http_mcp_persona.js";
import type * as insurance_summary from "../insurance/summary.js";
import type * as mcp_conversationSimulator from "../mcp/conversationSimulator.js";
import type * as mcp_getEmailsAction from "../mcp/getEmailsAction.js";
import type * as mcp_index from "../mcp/index.js";
import type * as mcp_personaAction from "../mcp/personaAction.js";
import type * as mcp_personaGenerator from "../mcp/personaGenerator.js";
import type * as mcp_policyAnalyzer from "../mcp/policyAnalyzer.js";
import type * as mcp_recommendationEngine from "../mcp/recommendationEngine.js";
import type * as mcp_riskAssessment from "../mcp/riskAssessment.js";
import type * as queries_emails from "../queries/emails.js";
import type * as utils_emailFilter from "../utils/emailFilter.js";
import type * as utils_supabase from "../utils/supabase.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/environment": typeof agent_environment;
  "agents/environmentAgent": typeof agents_environmentAgent;
  "agents/insuranceAnalyzer": typeof agents_insuranceAnalyzer;
  "auth/google": typeof auth_google;
  "auth/oauth": typeof auth_oauth;
  "auth/realoauth": typeof auth_realoauth;
  "emails/filter": typeof emails_filter;
  "endpoints/database": typeof endpoints_database;
  "endpoints/health": typeof endpoints_health;
  "gmail/debug": typeof gmail_debug;
  "gmail/fetch": typeof gmail_fetch;
  "gmail/fetch_get": typeof gmail_fetch_get;
  "gmail/getemails": typeof gmail_getemails;
  "gmail/sync": typeof gmail_sync;
  "gmail/syncreal": typeof gmail_syncreal;
  http: typeof http;
  http_mcp_persona: typeof http_mcp_persona;
  "insurance/summary": typeof insurance_summary;
  "mcp/conversationSimulator": typeof mcp_conversationSimulator;
  "mcp/getEmailsAction": typeof mcp_getEmailsAction;
  "mcp/index": typeof mcp_index;
  "mcp/personaAction": typeof mcp_personaAction;
  "mcp/personaGenerator": typeof mcp_personaGenerator;
  "mcp/policyAnalyzer": typeof mcp_policyAnalyzer;
  "mcp/recommendationEngine": typeof mcp_recommendationEngine;
  "mcp/riskAssessment": typeof mcp_riskAssessment;
  "queries/emails": typeof queries_emails;
  "utils/emailFilter": typeof utils_emailFilter;
  "utils/supabase": typeof utils_supabase;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
