// restock-suggestion.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for providing restock suggestions based on historical sales data and current stock levels.
 *
 * - getRestockSuggestion - A function that takes historical sales data and stock levels as input and returns restock suggestions.
 * - RestockSuggestionInput - The input type for the getRestockSuggestion function.
 * - RestockSuggestionOutput - The return type for the getRestockSuggestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the restock suggestion flow
const RestockSuggestionInputSchema = z.object({
  historicalSalesData: z.string().describe('Historical sales data for the product, in JSON format.'),
  currentStockLevel: z.number().describe('The current stock level of the product.'),
  productName: z.string().describe('The name of the product.'),
});
export type RestockSuggestionInput = z.infer<typeof RestockSuggestionInputSchema>;

// Define the output schema for the restock suggestion flow
const RestockSuggestionOutputSchema = z.object({
  reorderQuantity: z.number().describe('The suggested reorder quantity for the product.'),
  reasoning: z.string().describe('The reasoning behind the suggested reorder quantity.'),
});
export type RestockSuggestionOutput = z.infer<typeof RestockSuggestionOutputSchema>;

// Define the main function that will be called from the outside
export async function getRestockSuggestion(input: RestockSuggestionInput): Promise<RestockSuggestionOutput> {
  return restockSuggestionFlow(input);
}

// Define the prompt for the restock suggestion
const restockSuggestionPrompt = ai.definePrompt({
  name: 'restockSuggestionPrompt',
  input: {schema: RestockSuggestionInputSchema},
  output: {schema: RestockSuggestionOutputSchema},
  prompt: `You are an expert warehouse manager. Analyze the historical sales data and current stock level for a product and suggest an optimal reorder quantity.

Product Name: {{{productName}}}

Historical Sales Data: {{{historicalSalesData}}}

Current Stock Level: {{{currentStockLevel}}}

Based on this information, what is the optimal reorder quantity to avoid stockouts or overstocking? Explain your reasoning.

Considerations:
- Lead time for reordering
- Storage capacity
- Potential changes in demand

Output the reorder quantity and reasoning in JSON format.`,
});

// Define the Genkit flow for restock suggestion
const restockSuggestionFlow = ai.defineFlow(
  {
    name: 'restockSuggestionFlow',
    inputSchema: RestockSuggestionInputSchema,
    outputSchema: RestockSuggestionOutputSchema,
  },
  async input => {
    const {output} = await restockSuggestionPrompt(input);
    return output!;
  }
);
