import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  HeartPulse,
  ImagePlus,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  Save,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Trash2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import { HealthPost, HealthPostIcon, HealthPostPayload } from '../types';
import {
  HEALTH_POST_ICON_OPTIONS,
  HEALTH_POST_IMAGE_ASPECT_LABEL,
  HEALTH_POST_IMAGE_HEIGHT,
  HEALTH_POST_IMAGE_WIDTH,
  HEALTH_POST_TEXT_LIMIT,
  buildDefaultHealthPosts,
  getHealthPostIconMeta,
} from '../src/healthPosts';

const iconByType: Record<HealthPostIcon, LucideIcon> = {
  shield: ShieldCheck,
  heart: HeartPulse,
  bell: BellRing,
  newspaper: Newspaper,
  calendar: CalendarDays,
  stethoscope: Stethoscope,
  syringe: Syringe,
  megaphone: Megaphone,
};

const MAX_IMAGE_DATA_URL_LENGTH = 1600000;

const createEmptyForm = (displayOrder = 1): HealthPostPayload => ({
  title: '',
  context: '',
  text: '',
  icon: 'newspaper',
  imageUrl: '/news/noticia-saude-geral.png',
  published: true,
  displayOrder,
});

const resizeImageToPostFormat = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Selecione um arquivo de imagem.'));
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = HEALTH_POST_IMAGE_WIDTH;
    canvas.height = HEALTH_POST_IMAGE_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Nao foi possivel preparar a imagem.'));
      return;
    }

    const targetRatio = HEALTH_POST_IMAGE_WIDTH / HEALTH_POST_IMAGE_HEIGHT;
    const sourceRatio = image.width / image.height;
    const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
    const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      HEALTH_POST_IMAGE_WIDTH,
      HEALTH_POST_IMAGE_HEIGHT,
    );

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.58) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    URL.revokeObjectURL(objectUrl);
    resolve(dataUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Nao foi possivel ler a imagem.'));
  };

  image.src = objectUrl;
});

const PostPreview: React.FC<{ post: HealthPostPayload | HealthPost }> = ({ post }) => {
  const meta = getHealthPostIconMeta(post.icon);
  const Icon = iconByType[post.icon] || Newspaper;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-950">
        {post.imageUrl ? (
          <img className="h-full w-full object-cover" src={post.imageUrl} alt="" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <ImagePlus className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-5">
        <span
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${meta.accent} 16%, white), color-mix(in srgb, ${meta.accentSecondary} 14%, white))`,
            color: meta.accent,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
          {post.context || 'Contexto'}
        </p>
        <h3 className="mt-3 text-lg font-black leading-tight text-[#06296F] dark:text-slate-100">
          {post.title || 'Título da publicação'}
        </h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">
          {post.text || 'Texto da publicação para aparecer na landing page.'}
        </p>
      </div>
    </article>
  );
};

export const HealthPostsPage: React.FC = () => {
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [formData, setFormData] = useState<HealthPostPayload>(createEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const publishedCount = useMemo(() => posts.filter(post => post.published).length, [posts]);
  const draftCount = posts.length - publishedCount;

  const loadPosts = async () => {
    setLoading(true);
    const data = await api.healthPosts.getAll();
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const resetForm = () => {
    setFormData(createEmptyForm(posts.length + 1));
    setEditingId(null);
    setError('');
  };

  const startNewPost = () => {
    resetForm();
    setFeedback('');
  };

  const startEdit = (post: HealthPost) => {
    setEditingId(post.id);
    setFormData({
      title: post.title,
      context: post.context,
      text: post.text,
      icon: post.icon,
      imageUrl: post.imageUrl,
      published: post.published,
      displayOrder: post.displayOrder,
    });
    setError('');
    setFeedback('');
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageLoading(true);
    setError('');
    try {
      const imageUrl = await resizeImageToPostFormat(file);
      setFormData(prev => ({ ...prev, imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    } finally {
      setImageLoading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const payload: HealthPostPayload = {
      ...formData,
      title: formData.title.trim(),
      context: formData.context.trim(),
      text: formData.text.trim(),
      displayOrder: Number(formData.displayOrder) || 0,
    };

    if (!payload.title || !payload.context || !payload.text || !payload.imageUrl) {
      setError('Preencha imagem, título, contexto e texto.');
      return;
    }

    if (payload.text.length > HEALTH_POST_TEXT_LIMIT) {
      setError(`O texto deve ter no máximo ${HEALTH_POST_TEXT_LIMIT} caracteres.`);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.healthPosts.update(editingId, payload);
        setFeedback('Publicação atualizada.');
      } else {
        await api.healthPosts.add(payload);
        setFeedback('Publicação criada.');
      }
      await loadPosts();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar a publicação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: HealthPost) => {
    if (!confirm(`Remover a publicação "${post.title}"?`)) return;
    await api.healthPosts.delete(post.id);
    setFeedback('Publicação removida.');
    if (editingId === post.id) resetForm();
    await loadPosts();
  };

  const applyDefaultPosts = () => {
    const fallback = buildDefaultHealthPosts()[0];
    setFormData({
      title: fallback.title,
      context: fallback.context,
      text: fallback.text,
      icon: fallback.icon,
      imageUrl: fallback.imageUrl,
      published: true,
      displayOrder: posts.length + 1,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.22em] text-primary">Fique por dentro</span>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">Publicações do site</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
            Gerencie as notícias e campanhas que aparecem na página inicial do Conecta Saúde Olinda.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-white transition-colors hover:bg-primary-dark"
          onClick={startNewPost}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nova publicação
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Publicadas', publishedCount, Eye, 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'],
          ['Rascunhos', draftCount, EyeOff, 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
          ['Total', posts.length, Newspaper, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
        ].map(([label, value, Icon, tone]) => {
          const MetricIcon = Icon as typeof Eye;
          return (
            <article key={label as string} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone as string}`}>
                <MetricIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label as string}</p>
                <strong className="text-xl font-black text-slate-900 dark:text-slate-100">{value as number}</strong>
              </div>
            </article>
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Publicações cadastradas</h3>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ordem menor aparece primeiro na landing.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-slate-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />
              <span className="font-bold">Carregando publicações...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <Newspaper className="mb-3 h-8 w-8 text-primary" />
              <strong className="text-slate-900 dark:text-slate-100">Nenhuma publicação cadastrada</strong>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Crie a primeira notícia para aparecer na página inicial.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {posts.map(post => {
                const meta = getHealthPostIconMeta(post.icon);
                const Icon = iconByType[post.icon] || Newspaper;
                return (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img className="h-full w-full object-cover" src={post.imageUrl} alt="" />
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900"
                              style={{ color: meta.accent }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>
                                {post.context}
                              </p>
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Ordem {post.displayOrder}</span>
                            </div>
                          </div>
                          <h4 className="mt-3 line-clamp-2 font-black leading-tight text-slate-900 dark:text-slate-100">{post.title}</h4>
                          <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">{post.text}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${post.published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {post.published ? 'Publicado' : 'Rascunho'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          onClick={() => startEdit(post)}
                          type="button"
                        >
                          <Edit3 className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                          onClick={() => handleDelete(post)}
                          type="button"
                          aria-label="Remover publicação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {editingId ? 'Editar publicação' : 'Nova publicação'}
              </h3>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Imagem {HEALTH_POST_IMAGE_WIDTH}x{HEALTH_POST_IMAGE_HEIGHT}px, formato {HEALTH_POST_IMAGE_ASPECT_LABEL}.
              </p>
            </div>
            {editingId && (
              <button className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={resetForm} type="button" aria-label="Cancelar edição">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-900 dark:text-slate-100">Imagem</span>
              <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                <div className="aspect-[4/3]">
                  {formData.imageUrl ? (
                    <img className="h-full w-full object-cover" src={formData.imageUrl} alt="" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Recorte central automático
                  </span>
                  <span className="relative inline-flex">
                    <input className="absolute inset-0 cursor-pointer opacity-0" type="file" accept="image/*" onChange={handleImageChange} />
                    <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white">
                      {imageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Alterar
                    </span>
                  </span>
                </div>
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900 dark:text-slate-100">Título</span>
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                  maxLength={96}
                  onChange={event => setFormData(prev => ({ ...prev, title: event.target.value }))}
                  placeholder="Título da publicação"
                  value={formData.title}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900 dark:text-slate-100">Ordem</span>
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                  min={0}
                  onChange={event => setFormData(prev => ({ ...prev, displayOrder: Number(event.target.value) }))}
                  type="number"
                  value={formData.displayOrder}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-900 dark:text-slate-100">Contexto</span>
              <input
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                maxLength={48}
                onChange={event => setFormData(prev => ({ ...prev, context: event.target.value }))}
                placeholder="Ex.: Vacinação, prevenção, campanha do mês"
                value={formData.context}
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">Texto</span>
                <span className={`text-xs font-black ${formData.text.length > HEALTH_POST_TEXT_LIMIT - 40 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {formData.text.length}/{HEALTH_POST_TEXT_LIMIT}
                </span>
              </div>
              <textarea
                className="min-h-32 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 font-semibold leading-6 text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
                maxLength={HEALTH_POST_TEXT_LIMIT}
                onChange={event => setFormData(prev => ({ ...prev, text: event.target.value }))}
                placeholder="Texto da publicação para o cidadão"
                value={formData.text}
              />
            </div>

            <div>
              <span className="mb-3 block text-sm font-black text-slate-900 dark:text-slate-100">Tipo de notícia</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {HEALTH_POST_ICON_OPTIONS.map(option => {
                  const Icon = iconByType[option.id] || Newspaper;
                  const selected = formData.icon === option.id;
                  return (
                    <button
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-primary bg-blue-50 shadow-sm dark:bg-blue-950/30' : 'border-slate-200 hover:border-primary/50 dark:border-slate-800 dark:hover:border-primary/50'}`}
                      key={option.id}
                      onClick={() => setFormData(prev => ({ ...prev, icon: option.id }))}
                      type="button"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-950" style={{ color: option.accent }}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm text-slate-900 dark:text-slate-100">{option.label}</strong>
                        <small className="line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{option.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-900 dark:bg-slate-950 dark:text-slate-100">
              Publicar na página inicial
              <input
                checked={formData.published}
                className="h-5 w-5 accent-primary"
                onChange={event => setFormData(prev => ({ ...prev, published: event.target.checked }))}
                type="checkbox"
              />
            </label>

            <div>
              <p className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">Pré-visualização</p>
              <PostPreview post={formData} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
                disabled={saving || imageLoading}
                type="submit"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {editingId ? 'Salvar alterações' : 'Publicar'}
              </button>
              <button
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-5 font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={applyDefaultPosts}
                type="button"
              >
                Usar modelo
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
