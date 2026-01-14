import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import type SoundBankObject from "Code/Shared/Object/SoundBankObject";

export default class SoundController extends AirshipSingleton {
	public SoundBanks: SoundBankObject[];
	public SoundTemplate: AudioSource;

	public Play(SoundName: string) {
		let Sound: SoundBankObject | undefined;
		for (const [_, Bank] of pairs(this.SoundBanks)) {
			if (Bank.Name === SoundName) {
				Sound = Bank;
				break;
			}
		}

		if (Sound) {
			const SoundFile = Asset.LoadAsset(`Assets/Resources/Sounds/Library/${Sound.Name}${math.random(1, Sound.BankSize)}.ogg`) as AudioClip;
			const SoundObject = Instantiate(this.SoundTemplate);
			SoundObject.clip = SoundFile;
			SoundObject.Play();

			const Position = Core().Client.Actor?.transform.position;
			if (Position) {
				SoundObject.gameObject.transform.position = Position;
			}

			Destroy(SoundObject.gameObject, SoundFile.length + 1);
		}
	}
}
