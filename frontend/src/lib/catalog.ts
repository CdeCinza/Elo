import { api } from './api';

export interface CatalogCategory {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  products_count?: number;
}

export interface RecipeLine {
  id: number;
  name: string;
  unit: string;
  qty_used: number;
}

export interface CatalogProduct {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
  ingredients?: RecipeLine[];
}

export interface CatalogIngredient {
  id: number;
  name: string;
  stock_qty: number;
  unit: string;
  min_stock_alert: number;
  is_low_stock: boolean;
}

export interface ProductPayload {
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
  ingredients: { id: number; qty_used: number }[];
}

export interface CategoryPayload {
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface IngredientPayload {
  name: string;
  stock_qty: number;
  unit: string;
  min_stock_alert: number;
}

export const INGREDIENT_UNITS = ['unidade', 'kg', 'g', 'L', 'ml', 'fatia', 'porção'];

/**
 * Carrega categorias, produtos e ingredientes do restaurante ativo em paralelo.
 */
export async function fetchCatalog(): Promise<{
  categories: CatalogCategory[];
  products: CatalogProduct[];
  ingredients: CatalogIngredient[];
}> {
  const [categoriesResponse, productsResponse, ingredientsResponse] = await Promise.all([
    api.get('/categories'),
    api.get('/products', { params: { per_page: 200 } }),
    api.get('/ingredients', { params: { per_page: 100 } }),
  ]);

  return {
    categories: categoriesResponse.data.data ?? [],
    products: productsResponse.data.data ?? [],
    ingredients: ingredientsResponse.data.data ?? [],
  };
}

/**
 * Converte o texto digitado ("12,90" ou "12.90") em número; retorna NaN quando inválido.
 */
export function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return normalized === '' ? NaN : Number(normalized);
}

export function formatDecimalInput(value: number, fractionDigits = 2): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
}

/**
 * Extrai os erros de validação (422) do Laravel no formato { campo: "primeira mensagem" }.
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  const response = (error as { response?: { status?: number; data?: { errors?: Record<string, string[]> } } })?.response;
  if (response?.status !== 422 || !response.data?.errors) return {};

  return Object.fromEntries(Object.entries(response.data.errors).map(([field, messages]) => [field, messages[0]]));
}
