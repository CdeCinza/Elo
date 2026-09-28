'use client';

import React, { useRef, useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { CatalogCategory, CategoryPayload, extractFieldErrors } from '@/lib/catalog';
import { CatalogModal, fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from './CatalogModal';

interface CategoryFormModalProps {
  category: CatalogCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Cadastro e edição de uma categoria do cardápio (ex.: Entradas, Bebidas).
 */
export function CategoryFormModal({ category, onClose, onSaved }: CategoryFormModalProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    if (!name.trim()) {
      setErrors({ name: 'Informe o nome da categoria.' });
      return;
    }

    const payload: CategoryPayload = { name: name.trim(), description: description.trim() || null, is_active: isActive };
    savingRef.current = true;
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      if (category) {
        await api.put(`/categories/${category.id}`, payload);
        onSaved(`Categoria ${payload.name} atualizada.`);
      } else {
        await api.post('/categories', payload);
        onSaved(`Categoria ${payload.name} criada.`);
      }
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setFormError(getApiErrorMessage(error, 'Não foi possível salvar a categoria.'));
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
      title={category ? 'Editar categoria' : 'Nova categoria'}
      subtitle="As categorias organizam o cardápio do tablet."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="category-name" className={fieldLabelClass}>Nome</label>
          <input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Entradas"
            maxLength={255}
            className={fieldInputClass}
            autoFocus
          />
          {errors.name && <p className="text-[11px] text-rose-700 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="category-description" className={fieldLabelClass}>Descrição curta</label>
          <input
            id="category-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Porções para compartilhar"
            className={fieldInputClass}
          />
        </div>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] cursor-pointer">
          <span>
            <span className="block text-xs font-semibold text-[#191817]">Visível no tablet</span>
            <span className="block text-[11px] text-[#78716A]">Categorias ocultas e seus pratos não aparecem para o cliente.</span>
          </span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-5 h-5 accent-[#C84E1F] shrink-0"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Salvando...' : category ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </div>
      </form>
    </CatalogModal>
  );
}
