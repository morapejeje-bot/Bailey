// Port fitur A2UI dari @rexxhayanasi/elaina-baileys 1.4.7 ke fork Baileys (TypeScript)
// Taruh di: src/Utils/a2ui.ts
// Butuh proto InteractiveMessage.bloksWidget (lihat langkah tambah proto)
import { randomUUID } from 'crypto'
type WASocket = { user?: { id: string }; relayMessage: (...args: any[]) => Promise<any> }
import { generateWAMessageFromContent } from './messages'

export const BLOKS_A2UI_TYPE = 'im_a2ui'
export const BLOKS_A2UI_REPLY_ACTION = 'a2ui_reply_action'
export const A2UI_VERSION = 'v0.9'
export const A2UI_BASIC_CATALOG = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'
export const A2UI_ROOT_ID = 'root'

type Json = Record<string, any>

export type A2UIComponent = Json & { id: string; component: string }

const clean = <T extends Json>(obj: T): T => {
	for (const key of Object.keys(obj)) {
		if (obj[key] === undefined) delete obj[key]
	}
	return obj
}

const payloadData = (data: unknown): string => {
	if (data === undefined || data === null) return ''
	if (typeof data === 'string') return data
	if (typeof data !== 'object' || Array.isArray(data)) {
		throw new TypeError('bloks data must be a JSON string or a plain object')
	}
	return JSON.stringify(data)
}

export const bloksWidget = ({
	type,
	data,
	uuid,
	fallback = ''
}: {
	type: string
	data?: unknown
	uuid?: string
	fallback?: string
}) => {
	if (typeof type !== 'string' || type.trim() === '') {
		throw new TypeError('bloksWidget requires a non-empty bloks type')
	}
	return { type, data: payloadData(data), uuid: uuid ?? randomUUID(), fallback: String(fallback) }
}

// ---------- komponen ----------
const node =
	(component: string) =>
	(id: string, extra: Json = {}): A2UIComponent => {
		if (typeof id !== 'string' || id.trim() === '') {
			throw new TypeError('every a2ui component needs a non-empty id')
		}
		return clean({ id, component, ...extra }) as A2UIComponent
	}

export const a2uiText = (id: string, text: string, { variant = 'body' }: { variant?: string } = {}) =>
	node('Text')(id, { text: String(text), variant })

export const a2uiImage = (
	id: string,
	url: string,
	{ variant = 'header', fit = 'cover' }: { variant?: string; fit?: string } = {}
) => {
	if (typeof url !== 'string' || url.trim() === '') throw new TypeError('a2uiImage requires a url')
	return node('Image')(id, { url, variant, fit })
}

const container =
	(component: string) =>
	(id: string, children: string[] = []) => {
		if (!Array.isArray(children)) throw new TypeError('a2ui container children must be an array of component ids')
		return node(component)(id, { children: children.map(String) })
	}

export const a2uiColumn = container('Column')
export const a2uiRow = container('Row')

export const a2uiCard = (id: string, child: string) => {
	if (typeof child !== 'string' || child.trim() === '') {
		throw new TypeError('a2uiCard takes the id of one child component, not an array')
	}
	return node('Card')(id, { child })
}

// elemen siap pakai (yang dikenal klien Android): info_card dan list_card
const element =
	(type: string) =>
	(el: Json = {}) => {
		if (el === null || typeof el !== 'object' || Array.isArray(el)) {
			throw new TypeError(`a2ui ${type} element must be a plain object`)
		}
		return { type, ...el }
	}

export const a2uiInfoCard = element('info_card')
export const a2uiListCard = element('list_card')

// ---------- surface / widget ----------
const FALLBACK_KEYS = ['text', 'title', 'label', 'body']

export const a2uiFallback = (components: Json | Json[]): string => {
	const list = Array.isArray(components) ? components : components && typeof components === 'object' ? [components] : []
	return list
		.map(c => FALLBACK_KEYS.map(k => c?.[k]).find(v => typeof v === 'string' && v.trim() !== '') ?? '')
		.filter(Boolean)
		.join('\n')
}

export interface A2UIOptions {
	uuid?: string
	surfaceId?: string
	root?: string
	catalogId?: string
	sendDataModel?: boolean
	version?: string
	type?: string
	title?: string
	fallback?: string
	data?: unknown
}

export const a2uiSurface = (
	components: A2UIComponent[],
	{ surfaceId, root = A2UI_ROOT_ID, catalogId, sendDataModel, version = A2UI_VERSION, type, title }: A2UIOptions = {}
) => {
	if (!Array.isArray(components) || components.length === 0) {
		throw new TypeError('a2uiSurface requires at least one component')
	}
	if (!components.some(c => c?.id === root)) {
		throw new TypeError(`a2ui components must include one with id "${root}" to serve as the root`)
	}
	return clean({
		version,
		type,
		title,
		createSurface: clean({
			surfaceId: surfaceId ?? `card-${randomUUID()}`,
			root,
			catalogId,
			sendDataModel: sendDataModel === undefined ? undefined : !!sendDataModel,
			components
		})
	})
}

export const a2uiWidget = (components: A2UIComponent[], opts: A2UIOptions = {}) => {
	const id = opts.uuid ?? randomUUID()
	const payload = opts.data ?? a2uiSurface(components, { ...opts, surfaceId: opts.surfaceId ?? `card-${id}` })
	return bloksWidget({
		type: BLOKS_A2UI_TYPE,
		uuid: id,
		fallback:
			opts.fallback === undefined
				? a2uiFallback(Array.isArray(components) && components.length ? components : (payload as Json))
				: opts.fallback,
		data: payload
	})
}

// ---------- kirim ----------
export interface SendA2UIOptions extends A2UIOptions {
	buttons?: { name: string; buttonParamsJson: string }[]
	contextInfo?: Json
	messageId?: string
	additionalNodes?: any[]
}

export const sendA2UI = async (
	sock: WASocket,
	jid: string,
	components: A2UIComponent[],
	{ buttons = [], contextInfo, messageId, additionalNodes = [], ...widgetOpts }: SendA2UIOptions = {}
) => {
	if (!sock) throw new TypeError('sendA2UI requires a socket as the first argument')
	if (!jid) throw new TypeError('sendA2UI requires a target jid')
	if (!Array.isArray(buttons)) throw new TypeError('sendA2UI buttons must be an array of native flow buttons')

	const widget = a2uiWidget(components, widgetOpts)

	const msg = generateWAMessageFromContent(
		jid,
		{
			interactiveMessage: clean({
				nativeFlowMessage: { buttons, messageParamsJson: JSON.stringify({}), messageVersion: 1 },
				bloksWidget: widget,
				...(widget.fallback ? { body: { text: widget.fallback } } : {}),
				contextInfo
			})
		} as any,
		{ messageId, userJid: sock.user!.id } as any
	)

	await sock.relayMessage(msg.key.remoteJid!, msg.message!, {
		messageId: msg.key.id!,
		additionalNodes: [
			{
				tag: 'biz',
				attrs: {},
				content: [
					{
						tag: 'interactive',
						attrs: { type: 'native_flow', v: '1' },
						content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
					}
				]
			},
			...additionalNodes
		]
	})

	return msg
}

// ---------- baca pesan masuk ----------
export const decodeBloksWidget = (msg: any) => {
	const message = msg?.message ?? msg
	const interactive =
		message?.interactiveMessage ??
		message?.viewOnceMessage?.message?.interactiveMessage ??
		message?.viewOnceMessageV2?.message?.interactiveMessage

	const widget = interactive?.bloksWidget
	if (!widget) return null

	let params: any = null
	try {
		params = widget.data ? JSON.parse(widget.data) : null
	} catch {
		params = null
	}

	return { type: widget.type ?? '', uuid: widget.uuid ?? '', fallback: widget.fallback ?? '', params }
}
