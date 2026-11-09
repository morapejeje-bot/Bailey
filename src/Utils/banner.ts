// Banner start-up Yanzmoralex Baileys (tampil sekali saat library di-load)
const WIDTH = 53
const NAME = 'Yanzmoralex baileys'
import { readFileSync as readPkg } from 'fs'
const VERSION: string = (() => { try { return JSON.parse(readPkg(new URL('../../package.json', import.meta.url), 'utf8')).version } catch { return '?' } })()

const ART: string[] = ['█   █   ███   ████    ███   █      █████  █   █', '██ ██  █   █  █   █  █   █  █      █       █ █ ', '█ █ █  █   █  ████   █████  █      ████     █  ', '█   █  █   █  █  █   █   █  █      █       █ █ ', '█   █   ███   █   █  █   █  █████  █████  █   █']

const useColor = !process.env['NO_COLOR'] && process.env['MORA_BANNER_COLOR'] !== 'off'

const paint = (text: string, r: number, g: number, b: number, bold = false) =>
	useColor ? (bold ? '\x1b[1m' : '') + '\x1b[38;2;' + r + ';' + g + ';' + b + 'm' + text + '\x1b[0m' : text

const center = (text: string) => {
	const total = Math.max(0, WIDTH - text.length)
	const left = Math.floor(total / 2)
	return ' '.repeat(left) + text + ' '.repeat(total - left)
}

// gradasi pink -> ungu dari baris atas ke bawah
const gradient = (row: number, rows: number): [number, number, number] => {
	const t = rows <= 1 ? 0 : row / (rows - 1)
	return [Math.round(255 + (170 - 255) * t), Math.round(105 + (120 - 105) * t), Math.round(180 + (255 - 180) * t)]
}

export const printBanner = () => {
	if (process.env['MORA_BANNER'] === 'off') {
		return
	}

	const edge = (inner: string) => paint('│', 255, 105, 180) + inner + paint('│', 255, 105, 180)
	const empty = edge(' '.repeat(WIDTH))
	const lines: string[] = []

	lines.push(paint('╭' + '─'.repeat(WIDTH) + '╮', 255, 105, 180))
	lines.push(empty)
	ART.forEach((row, i) => {
		const [r, g, b] = gradient(i, ART.length)
		lines.push(edge(paint(center(row), r, g, b, true)))
	})
	lines.push(empty)
	lines.push(edge(paint(center('-' + NAME + '-'), 255, 255, 255, true)))
	lines.push(edge(paint(center('V ' + VERSION + ' POWERED ON'), 120, 255, 160, true)))
	lines.push(empty)
	lines.push(edge(paint(center('Node ' + process.version), 150, 150, 170)))
	lines.push(edge(paint(center('github.com/morapejeje-bot/Bailey'), 150, 150, 170)))
	lines.push(paint('╰' + '─'.repeat(WIDTH) + '╯', 255, 105, 180))

	console.log('\n' + lines.join('\n') + '\n')
}
