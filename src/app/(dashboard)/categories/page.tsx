'use client';

import React, { useEffect, useState } from 'react';
import { Tags, Plus, Trash2, Folder } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#0284c7');

  // Tag Form
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [savingTag, setSavingTag] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, tagRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tags'),
      ]);
      if (catRes.data?.success) setCategories(catRes.data.data || []);
      if (tagRes.data?.success) setTags(tagRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      const response = await api.post('/categories', {
        name: catName,
        color: catColor,
      });
      if (response.data?.success) {
        setIsCatModalOpen(false);
        setCatName('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    try {
      setSavingTag(true);
      const res = await api.post('/tags', {
        name: tagName,
        color: tagColor,
      });
      if (res.data?.success) {
        setTagName('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      await api.delete(`/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Categories & Tags</h2>
          <p className="mt-1 text-xs text-slate-500">
            Organize tasks, projects, and learning materials with division categories and custom tags.
          </p>
        </div>
        <Button
          onClick={() => setIsCatModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
          className="shrink-0"
        >
          New Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Categories Column */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Division Categories ({categories.length})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading categories...</div>
          ) : categories.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 italic">No categories created.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#0284c7' }}
                    />
                    <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1 text-slate-300 hover:text-red-500 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Column */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Quick Tags ({tags.length})
              </h3>
            </div>
          </div>

          {/* Quick Tag Adder */}
          <form onSubmit={handleCreateTag} className="flex gap-2">
            <input
              type="text"
              placeholder="Add new tag name..."
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs focus:border-sky-500 focus:outline-none"
            />
            <Button size="sm" loading={savingTag} type="submit">
              Add Tag
            </Button>
          </form>

          {/* Tags Chips */}
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color || '#0284c7' }}
                />
                <span>{tag.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-slate-400 hover:text-red-500 ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CREATE CATEGORY MODAL */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Create Category"
        description="Add a division or subject grouping."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory}>Create Category</Button>
          </>
        }
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Administrator, Engineering, Marketing"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-xs font-mono text-slate-500">{catColor}</span>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
