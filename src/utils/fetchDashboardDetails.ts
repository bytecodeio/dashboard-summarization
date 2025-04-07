import { Filters } from "@looker/extension-sdk";
import { DashboardMetadata, Query } from "../types";

const applyFilterToListeners = (data, filters, dashboardFilters) => {
  if (dashboardFilters !== null) {
    const filterListeners = data.filter((item) => item.listen.length > 0);
    filterListeners.forEach((filter) => {
      filter.listen.forEach((listener) => {
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
      return res.filter((d) => d.query !== null || d.result_maker !== null)
        .map((data) => {
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
  return { dashboardFilters, dashboardId, queries, description, prompt };
};