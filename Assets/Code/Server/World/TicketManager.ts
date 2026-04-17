import type { Player } from "@Easy/Core/Shared/Player/Player";
import Config from "Code/Client/Config";
import type { BlockState } from "Code/Core/World/Block/BlockState";
import type { Resource } from "Code/Shared/Types";
import ENV from "../ENV";

interface ChunkPos extends Vector3 {}

export type ChunkTicket = {
	ChunkKey: ChunkPos;
	TicketID: string;
};

export interface PlayerChunkTicket extends ChunkTicket {
	Player: Player;
	Entry: PlayerChunkEntry;
}

export interface PlayerChunkEntry {
	Tickets: PlayerChunkTicket[];
	Player: Player[];
	RenderDistance: number;
}

export interface ChunkDataFormat {
	Version: number;
	Data: string;
	Palette: Resource[];
	SavedTime: number;
}

export function GetChunkDataStoreKey(ChunkKey: ChunkPos) {
	return `${ENV.Runtime}-World:${Config.Seed}-Chunk:${ChunkKey.x},${ChunkKey.y},${ChunkKey.z}`;
}

export function SerializeChunk(Blocks: BlockState[]) {
	const Palette: Resource[] = [];
	const Buf = buffer.create(8192); // 4096 entries 2 bytes per entry
	for (const [Index, State] of pairs(Blocks)) {
		const ID = State.Block.Identifier.AsResource();
		let PaletteIndex = Palette.indexOf(ID);
		if (PaletteIndex === -1) PaletteIndex = Palette.push(ID);

		buffer.writeu16(Buf, (Index - 1) * 2, PaletteIndex);
	}

	return {
		Version: 1,
		Data: buffer.tostring(buffer.compress(Buf)),
		Palette: Palette,
		SavedTime: os.clock(),
	} satisfies ChunkDataFormat;
}

/**
 * deserialize chunk from datastore format back to block states.
 * @param data data
 * @returns block id array
 */
export function DeserializeChunk(Data: ChunkDataFormat) {
	const Buf = buffer.decompress(buffer.fromstring(Data.Data));

	const Blocks: Resource[] = [];
	for (const Index of $range(1, 4096)) {
		const PaletteIndex = buffer.readu16(Buf, (Index - 1) * 2);
		Blocks.push(Data.Palette[PaletteIndex - 1]);
	}

	return Blocks;
}

export class TicketManager {}
