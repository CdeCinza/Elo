'use client';

import React, { useRef, useState } from 'react';
import { ImageOff, Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  CatalogCategory,
  CatalogIngredient,
  CatalogProduct,
  ProductPayload,
  extractFieldErrors,
  formatDecimalInput,
  parseDecimalInput,
} from '@/lib/catalog';
import { formatBRL } from '@/lib/format';
import { CatalogModal, fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from './CatalogModal';

interface ProductFormModalProps {
  product: CatalogProduct | null;
  categories: CatalogCategory[];
  ingredients: CatalogIngredient[];
  defaultCategoryId?: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface RecipeDraftLine {
  key: number;
  ingredientId: string;
  quantity: string;
}

/**
 * Cadastro e edição de um prato, incluindo a ficha técnica usada na baixa automática de estoque.
 */
export function ProductFormModal({ product, categories, ingredients, defaultCategoryId, onClose, onSaved }: ProductFormModalProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(String(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? ''));
  const [price, setPrice] = useState(
    product ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  );
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [available, setAvailable] = useState(product?.available ?? true);
  const [recipe, setRecipe] = useState<RecipeDraftLine[]>(
    (product?.ingredients ?? []).map((line, index) => ({
      key: index,
      ingredientId: String(line.id),
      quantity: formatDecimalInput(line.qty_used, 3),
    }))
  );
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const parsedPrice = parseDecimalInput(price);
  const unitFor = (ingredientId: string) => ingredients.find((i) => String(i.id) === ingredientId)?.unit ?? '';

  const updateRecipeLine = (key: number, changes: Partial<RecipeDraftLine>) => {
    setRecipe((lines) => lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = 'Informe o nome do prato.';
    if (!categoryId) localErrors.category_id = 'Escolha uma categoria.';
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) localErrors.price = 'Informe um preço válido (ex.: 34,90).';

    const recipeLines = recipe.filter((line) => line.ingredientId !== '');
    const recipePayload = recipeLines.map((line) => ({ id: Number(line.ingredientId), qty_used: parseDecimalInput(line.quantity) }));
    if (recipePayload.some((line) => Number.isNaN(line.qty_used) || line.qty_used <= 0)) {
      localErrors.ingredients = 'Informe a quantidade de cada ingrediente da ficha técnica.';
    }
    if (new Set(recipePayload.map((line) => line.id)).size !== recipePayload.length) {
      localErrors.ingredients = 'Cada ingrediente só pode aparecer uma vez na ficha técnica.';
    }

    setErrors(localErrors);
    setFormError(null);
    if (Object.keys(localErrors).length > 0) return;

    const payload: ProductPayload = {
      category_id: Number(categoryId),
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(parsedPrice * 100) / 100,
      available,
      image_url: imageUrl.trim() || null,
      ingredients: recipePayload,
    };

    savingRef.current = true;
    setSaving(true);
    try {
      if (product) {
        await api.put(`/products/${product.id}`, payload);
        onSaved(`${payload.name} atualizado.`);
      } else {
        await api.post('/products', payload);
        onSaved(`${payload.name} adicionado ao cardápio.`);
      }
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setFormError(getApiErrorMessage(error, 'Não foi possível salvar o prato.'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const recipeError = errors.ingredients ?? Object.entries(errors).find(([field]) => field.startsWith('ingredients.'))?.[1];

  return (
    <CatalogModal
      isOpen
      isBusy={saving}
      onClose={onClose}
      title={product ? 'Editar prato' : 'Novo prato'}
      subtitle="Aparece no tablet das mesas e no caixa assim que for salvo."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="product-name" className={fieldLabelClass}>Nome do prato</label>
          <input
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Burger da Casa"
            maxLength={255}
            className={fieldInputClass}
            autoFocus
          />
          {errors.name && <p className="text-[11px] text-rose-700 mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-category" className={fieldLabelClass}>Categoria</label>
            <select
              id="product-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={fieldInputClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.is_active ? '' : ' (oculta)'}
                </option>
              ))}
            </select>
            {errors.category_id && <p className="text-[11px] text-rose-700 mt-1">{errors.category_id}</p>}
          </div>
          <div>
            <label htmlFor="product-price" className={fieldLabelClass}>Preço (R$)</label>
            <input
              id="product-price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              inputMode="decimal"
              placeholder="0,00"
              className={fieldInputClass}
            />
            {errors.price ? (
              <p className="text-[11px] text-rose-700 mt-1">{errors.price}</p>
            ) : (
              !Number.isNaN(parsedPrice) && <p className="text-[11px] text-[#78716A] mt-1">{formatBRL(parsedPrice)}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="product-description" className={fieldLabelClass}>Descrição</label>
          <textarea
            id="product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Ingredientes principais e o que torna o prato especial."
            className={fieldInputClass}
          />
        </div>

        <div>
          <label htmlFor="product-image" className={fieldLabelClass}>Foto (link da imagem)</label>
          <div className="flex gap-3 items-start">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#E0DBD3] bg-[#FAF8F5] shrink-0 flex items-center justify-center">
              {imageUrl && !imageFailed ? (
                <img src={imageUrl} alt="Prévia do prato" className="w-full h-full object-cover" onError={() => setImageFailed(true)} />
              ) : (
                <ImageOff className="w-5 h-5 text-[#A8A199]" />
              )}
            </div>
            <div className="flex-1">
              <input
                id="product-image"
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageFailed(false);
                }}
                placeholder="https://..."
                className={fieldInputClass}
              />
              {errors.image_url ? (
                <p className="text-[11px] text-rose-700 mt-1">{errors.image_url}</p>
              ) : (
                imageFailed && <p className="text-[11px] text-amber-700 mt-1">Não foi possível carregar essa imagem.</p>
              )}
            </div>
          </div>
        </div>

        <fieldset>
          <legend className={fieldLabelClass}>Ficha técnica (baixa automática de estoque)</legend>
          {ingredients.length === 0 ? (
            <p className="text-[11px] text-[#78716A]">Cadastre ingredientes na aba “Estoque” para montar a ficha técnica.</p>
          ) : (
            <div className="space-y-2">
              {recipe.map((line) => (
                <div key={line.key} className="flex items-center gap-2">
                  <select
                    aria-label="Ingrediente"
                    value={line.ingredientId}
                    onChange={(e) => updateRecipeLine(line.key, { ingredientId: e.target.value })}
                    className={`${fieldInputClass} flex-1 min-w-0`}
                  >
                    <option value="">Escolha...</option>
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Quantidade usada"
                    value={line.quantity}
                    onChange={(e) => updateRecipeLine(line.key, { quantity: e.target.value.replace(/[^0-9.,]/g, '') })}
                    inputMode="decimal"
                    placeholder="Qtd."
                    className={`${fieldInputClass} w-20`}
                  />
                  <span className="text-[11px] text-[#78716A] w-12 truncate">{unitFor(line.ingredientId)}</span>
                  <button
                    type="button"
                    onClick={() => setRecipe((lines) => lines.filter((l) => l.key !== line.key))}
                    aria-label="Remover ingrediente"
                    className="p-2 rounded-lg text-[#78716A] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecipe((lines) => [...lines, { key: Date.now(), ingredientId: '', quantity: '' }])}
                className="text-xs text-[#C84E1F] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar ingrediente
              </button>
            </div>
          )}
          {recipeError && <p className="text-[11px] text-rose-700 mt-1">{recipeError}</p>}
        </fieldset>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] cursor-pointer">
          <span>
            <span className="block text-xs font-semibold text-[#191817]">Disponível para pedidos</span>
            <span className="block text-[11px] text-[#78716A]">Desligue quando o prato acabar: ele some do tablet na hora.</span>
          </span>
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="w-5 h-5 accent-[#C84E1F] shrink-0"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Salvando...' : product ? 'Salvar alterações' : 'Adicionar ao cardápio'}
          </button>
        </div>
      </form>
    </CatalogModal>
  );
}
