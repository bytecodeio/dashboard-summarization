import React, { useContext } from "react"
import styled from "styled-components"
import { SummaryDataContext } from './contexts/SummaryDataContext'

const BoxContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
  max-height: 220px;
`

const QueryBox = styled.a`
  display: inline-block;
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  flex-shrink: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: background-color 0.3s ease;
  width: 100%;
  height: auto;
  &:hover {
    background-color: #0056b3;
  }
`
// Here is the format of the querySuggestions string:
// ---------
// '''json
// [
//     {"querySuggestion": "Show me the top XXX entries for YYY"},
//     {"querySuggestion": "What are the higest and lowest values for ZZZ, grouped by AAAA?"},
//     ...
// ]
// '''
interface ParsedQuerySuggestion {
    querySuggestion: string
    }
interface ParsedQuerySuggestions extends Array<ParsedQuerySuggestion> {}

export const QuerySuggestions: React.FC = () => {
  const { querySuggestions } = useContext(SummaryDataContext) as any
  if (!querySuggestions || querySuggestions.length === 0) return null
  
  // Replace ''' and '''json with empty strings
  const cleanedQuerySuggestions = querySuggestions.replace(/'''json|'''/g, '')
  // Parse the cleaned string as JSON
  const parsedQuerySuggestions: ParsedQuerySuggestions = JSON.parse(cleanedQuerySuggestions)
  return (
    <BoxContainer>
      {parsedQuerySuggestions.map((suggestion: ParsedQuerySuggestion, index: number) => (
        <QueryBox
          key={index}
          href={`https://easymetricsdevuseast1.cloud.looker.com/extensions/easymetrics::explore_assistant/index?queryPrompt=${encodeURIComponent(suggestion.querySuggestion)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {suggestion.querySuggestion}
        </QueryBox>
      ))}
    </BoxContainer>
  )
}