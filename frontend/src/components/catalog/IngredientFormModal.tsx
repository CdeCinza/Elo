'use client';

import React, { useRef, useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  CatalogIngredient,
  INGREDIENT_UNITS,
  IngredientPayload,
  extractFieldErrors,
  formatDecimalInput,
  parseDecimalInput,
} from '@/lib/catalog';
import { CatalogModal, fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from './CatalogModal';

interface IngredientFormModalProps {
  ingredient: CatalogIngredient | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Cadastro e ajuste de um insumo do estoque (quantidade atual e alerta de estoque baixo).
 */
export function IngredientFormModal({ ingredient, onClose, onSaved }: IngredientFormModalProps) {
  const [name, setName] = useState(ingredient?.name ?? '');
  const [unit, setUnit] = useState(ingredient?.unit ?? 'kg');
  const [stockQty, setStockQty] = useState(ingredient ? formatDecimalInput(ingredient.stock_qty, 3) : '');
  const [minStock, setMinStock] = useState(ingredient ? formatDecimalInput(ingredient.min_stock_alert, 3) : '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const unitOptions = INGREDIENT_UNITS.includes(unit) ? INGREDIENT_UNITS : [unit, ...INGREDIENT_UNITS];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    const parsedStock = parseDecimalInput(stockQty);
    const parsedMin = minStock.trim() === '' ? 0 : parseDecimalInput(minStock);
    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = 'Informe o nome do ingrediente.';
    if (Number.isNaN(parsedStock) || parsedStock < 0) localErrors.stock_qty = 'Informe a quantidade em estoque.';
    if (Number.isNaN(parsedMin) || parsedMin < 0) localErrors.min_stock_alert = 'Informe um valor válido.';
    setErrors(localErrors);
    setFormError(null);
    if (Object.keys(localErrors).length > 0) return;

    const payload: IngredientPayload = { name: name.trim(), unit, stock_qty: parsedStock, min_stock_alert: parsedMin };
    savingRef.current = true;
    setSaving(true);
    try {
      if (ingredient) {
        await api.put(`/ingredients/${ingredient.id}`, payload);
        onSaved(`${payload.name} atualizado.`);
      } else {
        await api.post('/ingredients', payload);
        onSaved(`${payload.name} adicionado ao estoque.`);
      }
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setFormError(getApiErrorMessage(error, 'Não foi possível salvar o ingrediente.'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <CatalogModal
      isOpen
      isBusy={saving}
      onClose={onClose}
      title={ingredient ? 'Ajustar ingrediente' : 'Novo ingrediente'}
      subtitle="O estoque baixa sozinho quando a cozinha começa um prato que usa este ingrediente."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="ingredient-name" className={fieldLabelClass}>Nome</label>
          <input
            id="ingredient-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Pão brioche"
            maxLength={255}
            className={fieldInputClass}
            autoFocus
          />
          {errors.name && <p className="text-[11px] text-rose-700 mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="ingredient-stock" className={fieldLabelClass}>Em estoque</label>
            <input
              id="ingredient-stock"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value.replace(/[^0-9.,]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className={fieldInputClass}
            />
          </div>
          <div>
            <label htmlFor="ingredient-unit" className={fieldLabelClass}>Unidade</label>
            <select id="ingredient-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldInputClass}>
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ingredient-min" className={fieldLabelClass}>Alerta abaixo de</label>
            <input
              id="ingredient-min"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value.replace(/[^0-9.,]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className={fieldInputClass}
            />
          </div>
        </div>
        {(errors.stock_qty || errors.min_stock_alert || errors.unit) && (
          <p className="text-[11px] text-rose-700 -mt-2">{errors.stock_qty ?? errors.min_stock_alert ?? errors.unit}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Salvando...' : ingredient ? 'Salvar ajuste' : 'Adicionar ao estoque'}
          </button>
        </div>
      </form>
    </CatalogModal>
  );
}
