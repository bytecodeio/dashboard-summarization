import { Filters } from "@looker/extension-sdk";
import { DashboardMetadata, Query } from "../types";
import { getCachedDashboardMetadata, cacheDashboardMetadata } from "./caching";

const applyFilterToListeners = (data: any, filters: any, dashboardFilters: any) => {
  if (dashboardFilters !== null) {
    const filterListeners = data.filter((item: any) => item.listen.length > 0);
    filterListeners.forEach((filter: any) => {
      filter.listen.forEach((listener: any) => {
        filters[listener.field] = dashboardFilters[listener.dashboard_filter_name];
      });
    });
    return filters;
  }
  return {};
};

export const fetchDashboardDetails = async (
  dashboardId: string,
  core40SDK: any,
  extensionSDK: any,
  dashboardFilters: Filters,
  tileHostData: any,
): Promise<DashboardMetadata> => {
  // Check cache first
  const cachedData = getCachedDashboardMetadata(dashboardId, dashboardFilters);
  if (cachedData) {
    console.log('Using cached dashboard metadata for:', dashboardId);
    return cachedData;
  }
  
  console.log('Fetching dashboard details from API for:', dashboardId);
  const dashboardResponse = await core40SDK.ok(core40SDK.dashboard(dashboardId));
  
  const { description } = dashboardResponse

  const getPrompt = (dashboardResponse: any, ) => {
    const dashboardElements = dashboardResponse.dashboard_elements;
    const elementId = tileHostData.elementId;
    const mountedElement = dashboardElements.find((element: any) => element.id === elementId);
    // extension_id: "mfa-pilot::dashboard-summarization"
    const note_text = mountedElement?.note_text;
    const doesItStartWithPrompt = note_text?.startsWith('Prompt:');
    if (doesItStartWithPrompt) {
      const prompt = note_text.split('Prompt:')[1].trim();
      return prompt;
    }
    return '';
  }
  const prompt = getPrompt(dashboardResponse);
  const queries = await core40SDK.ok(core40SDK.dashboard_dashboard_elements(
    dashboardId, 'query,result_maker,note_text,title,query_id'))
    .then((res: any) => {
      return res.filter((d: any) => d.query !== null || d.result_maker !== null)
        .map((data: any) => {
          const { query, note_text, title } = data;
          if (data.query !== null) {
            const { fields, dynamic_fields, view, model, filters, pivots, sorts, limit, column_limit, row_total, subtotals } = query;
            const newFilters = applyFilterToListeners(data.result_maker?.filterables, filters || {}, dashboardFilters);
            return { queryBody: { fields, dynamic_fields, view, model, filters: newFilters, pivots, sorts, limit, column_limit, row_total, subtotals }, note_text, title };
          } else if (data.result_maker!.query !== null) {
            const { fields, dynamic_fields, view, model, filters, pivots, sorts, limit, column_limit, row_total, subtotals } = data.result_maker!.query;
            const newFilters = applyFilterToListeners(data.result_maker?.filterables, filters || {}, dashboardFilters);
            return { queryBody: { fields, dynamic_fields, view, model, filters: newFilters, pivots, sorts, limit, column_limit, row_total, subtotals }, note_text, title };
          } else {
            return undefined;
          }
        });
    });
  
  const metadata: DashboardMetadata = { dashboardFilters, dashboardId, queries, description, prompt };
  
  // Cache the result
  cacheDashboardMetadata(dashboardId, dashboardFilters, metadata);
  
  return metadata;
};