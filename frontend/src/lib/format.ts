const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Formata valores monetários no padrão brasileiro (ex.: "R$ 1.234,50").
 */
export function formatBRL(value: number | string | null | undefined): string {
  return brlFormatter.format(Number(value) || 0);
}
