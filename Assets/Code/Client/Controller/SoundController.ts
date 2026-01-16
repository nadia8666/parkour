import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import type SoundBankObject from "Code/Shared/Object/SoundBankObject";

export default class SoundController extends AirshipSingleton {
	public SoundBanks: SoundBankObject[];
	public SoundMap: { [Index: string]: SoundBankObject } = {};
	public SoundTemplate: AudioSource;

	@Client()
	public Start() {
		for (const [_, Bank] of pairs(this.SoundBanks)) {
			this.SoundMap[Bank.Name] = Bank;

			for (const i of $range(1, Bank.BankSize)) {
				task.spawn(() => {
					const Clip = Asset.LoadAsset(`Assets/Resources/Sounds/Library/${Bank.Name}${i}.ogg`) as AudioClip;
					const SoundObject = Instantiate(this.SoundTemplate);
					SoundObject.clip = Clip;

					Destroy(SoundObject.gameObject, Clip.length + 2);
				});
			}
		}
	}

	public Play(SoundName: string, Config: { Volume?: number } = {}) {
		let Sound = this.SoundMap[SoundName];

		if (Sound) {
			const SoundFile = Asset.LoadAsset(`Assets/Resources/Sounds/Library/${Sound.Name}${math.random(1, Sound.BankSize)}.ogg`) as AudioClip;
			const SoundObject = Instantiate(this.SoundTemplate);
			SoundObject.clip = SoundFile;
			SoundObject.Play();

			SoundObject.volume = Config.Volume ?? 1;

			const Position = Core().Client.Actor?.transform.position;
			if (Position) {
				SoundObject.gameObject.transform.position = Position;
			}

			Destroy(SoundObject.gameObject, SoundFile.length + 1);
		}
	}
}
