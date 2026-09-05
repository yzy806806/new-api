/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useFieldArray, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// fork 扩展：能力复选框选项（对齐 models.dev 词汇表）
export const CHANNEL_CAPABILITY_OPTIONS = [
  { value: 'tools', label: 'Tools' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'structured_output', label: 'Structured Output' },
  { value: 'vision', label: 'Vision' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'caching', label: 'Caching' },
] as const

type ModelCapRow = {
  model: string
  context_length: string
  max_output_tokens: string
  capabilities: string[]
}

/** 解析 model_capabilities JSON -> 行数组 */
export function parseModelCapabilities(
  json: string | undefined | null
): ModelCapRow[] {
  if (!json || !json.trim()) return []
  try {
    const parsed = JSON.parse(json) as Record<
      string,
      {
        context_length?: number
        max_output_tokens?: number
        capabilities?: string[]
      }
    >
    return Object.entries(parsed).map(([model, caps]) => ({
      model,
      context_length: caps.context_length ? String(caps.context_length) : '',
      max_output_tokens: caps.max_output_tokens
        ? String(caps.max_output_tokens)
        : '',
      capabilities: Array.isArray(caps.capabilities) ? caps.capabilities : [],
    }))
  } catch {
    return []
  }
}

/** 行数组 -> model_capabilities JSON（跳过全空行） */
export function serializeModelCapabilities(rows: ModelCapRow[]): string {
  const out: Record<
    string,
    { context_length?: number; max_output_tokens?: number; capabilities?: string[] }
  > = {}
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) continue
    const ctx = Number.parseInt(row.context_length, 10)
    const mot = Number.parseInt(row.max_output_tokens, 10)
    const entry: Record<string, unknown> = {}
    if (Number.isFinite(ctx) && ctx > 0) entry.context_length = ctx
    if (Number.isFinite(mot) && mot > 0) entry.max_output_tokens = mot
    if (row.capabilities.length > 0) entry.capabilities = row.capabilities
    if (Object.keys(entry).length > 0) out[model] = entry
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : ''
}

type ModelCapabilitiesEditorProps = {
  models: string[]
  value: string
  onChange: (json: string) => void
}

/**
 * fork 扩展：渠道级模型能力编辑器。
 * 每个已发布模型一行：context_length / max_output_tokens 数值输入 + 能力复选框。
 */
export function ModelCapabilitiesEditor(props: ModelCapabilitiesEditorProps) {
  const { t } = useTranslation()
  const rows = parseModelCapabilities(props.value)

  const sync = (next: ModelCapRow[]) => {
    props.onChange(serializeModelCapabilities(next))
  }

  // 已发布但尚未声明能力的模型，补空行（保持与模型列表同步）
  const allRows: ModelCapRow[] = props.models.map((m) => {
    const found = rows.find((r) => r.model === m)
    return found || { model: m, context_length: '', max_output_tokens: '', capabilities: [] }
  })

  const updateRow = (idx: number, patch: Partial<ModelCapRow>) => {
    const next = allRows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    sync(next)
  }

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='space-y-3'>
      <FormDescription>
        {t(
          'Declare per-model capabilities exposed on /v1/models. Aggregated across channels: capabilities union, token limits max.'
        )}
      </FormDescription>
      <div className='space-y-3'>
        {allRows.map((row, idx) => (
          <div
            key={row.model}
            className='border-border/60 bg-muted/10 rounded-lg border p-3'
          >
            <div className='mb-2 flex items-center justify-between'>
              <span className='text-sm font-medium'>{row.model}</span>
            </div>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              <div className='space-y-1'>
                <label className='text-muted-foreground text-xs'>
                  {t('Context length')}
                </label>
                <Input
                  type='number'
                  min={0}
                  placeholder='e.g. 1000000'
                  value={row.context_length}
                  onChange={(e) =>
                    updateRow(idx, { context_length: e.target.value })
                  }
                />
              </div>
              <div className='space-y-1'>
                <label className='text-muted-foreground text-xs'>
                  {t('Max output tokens')}
                </label>
                <Input
                  type='number'
                  min={0}
                  placeholder='e.g. 131072'
                  value={row.max_output_tokens}
                  onChange={(e) =>
                    updateRow(idx, { max_output_tokens: e.target.value })
                  }
                />
              </div>
            </div>
            <div className='mt-2 flex flex-wrap gap-2'>
              {CHANNEL_CAPABILITY_OPTIONS.map((cap) => {
                const checked = row.capabilities.includes(cap.value)
                return (
                  <label
                    key={cap.value}
                    className='flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent'
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...row.capabilities, cap.value]
                          : row.capabilities.filter((c) => c !== cap.value)
                        updateRow(idx, { capabilities: next })
                      }}
                    />
                    {t(cap.label)}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
