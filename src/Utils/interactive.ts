import type { proto } from '../../WAProto/index.js'
import type { BinaryNode } from '../WABinary'

type NativeFlowButton = proto.Message.InteractiveMessage.NativeFlowMessage.INativeFlowButton

const toJson = (value: unknown) => JSON.stringify(value)

export type ListSection = {
	title: string
	highlight_label?: string
	rows: { header?: string; title: string; description?: string; id: string }[]
}

/** Pembuat tombol native flow, dipakai di interactiveButtons */
export const flowButton = {
	reply: (text: string, id: string): NativeFlowButton => ({
		name: 'quick_reply',
		buttonParamsJson: toJson({ display_text: text, id })
	}),
	url: (text: string, url: string): NativeFlowButton => ({
		name: 'cta_url',
		buttonParamsJson: toJson({ display_text: text, url, merchant_url: url })
	}),
	copy: (text: string, code: string): NativeFlowButton => ({
		name: 'cta_copy',
		buttonParamsJson: toJson({ display_text: text, id: code, copy_code: code })
	}),
	call: (text: string, phoneNumber: string): NativeFlowButton => ({
		name: 'cta_call',
		buttonParamsJson: toJson({ display_text: text, phone_number: phoneNumber })
	}),
	location: (text = 'Kirim Lokasi'): NativeFlowButton => ({
		name: 'send_location',
		buttonParamsJson: toJson({ display_text: text })
	}),
	list: (title: string, sections: ListSection[]): NativeFlowButton => ({
		name: 'single_select',
		buttonParamsJson: toJson({ title, sections })
	})
}

type BuildOptions = {
	body?: string
	footer?: string
	title?: string
	subtitle?: string
	header?: proto.Message.InteractiveMessage.IHeader
	buttons: NativeFlowButton[]
}

/** Menyusun isi pesan interactive (urutan key penting: interactiveMessage harus pertama) */
export const buildInteractiveContent = (opts: BuildOptions): proto.IMessage => {
	let header: proto.Message.InteractiveMessage.IHeader | undefined
	if (opts.header) {
		header = { ...opts.header, title: opts.title, subtitle: opts.subtitle }
	} else if (opts.title || opts.subtitle) {
		header = { title: opts.title, subtitle: opts.subtitle, hasMediaAttachment: false }
	}

	return {
		interactiveMessage: {
			header,
			body: { text: opts.body || '' },
			footer: opts.footer ? { text: opts.footer } : undefined,
			nativeFlowMessage: { buttons: opts.buttons, messageParamsJson: '' }
		},
		messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }
	}
}

const unwrap = (message: proto.IMessage): proto.IMessage => {
	let current = message
	for (let i = 0; i < 5; i++) {
		const inner =
			current.ephemeralMessage?.message ||
			current.viewOnceMessage?.message ||
			current.viewOnceMessageV2?.message ||
			current.viewOnceMessageV2Extension?.message
		if (!inner) break
		current = inner
	}

	return current
}

/** Menambah node <biz> (dan <bot> untuk chat pribadi) supaya tombol native flow tampil di WhatsApp */
export const injectInteractiveNodes = (
	message: proto.IMessage,
	nodes: BinaryNode[] | undefined,
	isPrivateChat: boolean
): BinaryNode[] | undefined => {
	const flow = unwrap(message).interactiveMessage?.nativeFlowMessage
	if (!flow?.buttons?.length) {
		return nodes
	}

	const list: BinaryNode[] = [...(nodes || [])]
	if (!list.some(n => n.tag === 'biz')) {
		list.push({
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'interactive',
					attrs: { type: 'native_flow', v: '1' },
					content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
				}
			]
		})
	}

	if (isPrivateChat && !list.some(n => n.tag === 'bot')) {
		list.push({ tag: 'bot', attrs: { biz_bot: '1' } })
	}

	return list
}
