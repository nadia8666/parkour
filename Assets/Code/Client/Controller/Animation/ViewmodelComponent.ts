import AnimationController, { type InferredAnimation, type SetAnimation } from "./AnimationController";

export default class ViewmodelComponent extends AirshipBehaviour {
	public AnimationController = AnimationController.Get();
	public Controller: Animator;
	public EventListener: AnimationEventListener;

	@Client()
	override Start() {
		this.EventListener.OnAnimEvent((Key) => {
			if (Key === "EndAnimation") {
				const Animation = this.AnimationController.AnimList[this.AnimationController.Current] as SetAnimation;

				if (Animation.EndAnimation) {
					this.AnimationController.Current = Animation.EndAnimation;
				}
			}
		});
	}

	/**
	 * Do not run
	 * @param Animation
	 * @param Playing
	 */
	@Client()
	private UpdateState(Animation: InferredAnimation, Playing: boolean, TransitionTime?: number) {
		if (Playing) {
			for (let i of $range(0, this.Controller.layerCount - 1)) {
				this.AnimationController.WeightLayers[i as 0].Target = 0;
			}

			for (const [Key, Value] of pairs(Animation)) {
				if (typeOf(Key) !== "number") {
					continue;
				}

				this.Controller.CrossFadeInFixedTime(Value.Name, TransitionTime ?? 0.15, Key);
				this.AnimationController.WeightLayers[Key as 0].Target = 1;
			}
		}
	}

	@Client()
	private GetCurrentTrack(Animation: InferredAnimation) {
		let [Track, Layer] = [Animation[0].Name, 0];

		for (const [Key, Value] of pairs(Animation)) {
			if (typeOf(Key) !== "number") {
				continue;
			}

			if (Value.Position !== undefined) {
				let Triggered = false;

				const Next = Animation[Key + 1];
				if (Next?.Position) {
					Triggered = this.AnimationController.ClientSpeed.x >= Value.Position && this.AnimationController.ClientSpeed.x < Next.Position;
				} else {
					Triggered = this.AnimationController.ClientSpeed.x >= Value.Position;
				}

				if (Triggered) {
					Track = Value.Name;
					Layer = Key;
					break;
				}
			}
		}

		return $tuple(Track, Layer);
	}

	@Client()
	private UpdateSpeed(Value: InferredAnimation[0]) {
		let Speed: number;

		if (Value.Speed) {
			Speed = Value.Speed.Base + Value.Speed.Increment * this.AnimationController.Speed;
			if (Value.Speed.Absolute) {
				Speed = math.abs(Speed);
			}
		} else {
			Speed = this.AnimationController.Speed;
		}

		this.Controller.SetFloat("AnimSpeed", Speed);
	}

	@Client()
	private CalculateWeightAndSpeed(Animation: InferredAnimation, Initial: boolean = false) {
		for (const [Key, Value] of pairs(Animation)) {
			if (typeOf(Key) !== "number") {
				continue;
			}

			if (Value.Position !== undefined) {
				this.AnimationController.WeightLayers[Key as 0].Target = this.GetCurrentTrack(Animation)[0] === Value.Name ? 1 : 0.01;

				if (Initial) this.AnimationController.WeightLayers[Key as 0].Current = this.AnimationController.WeightLayers[Key as 0].Target;
			}

			this.UpdateSpeed(Value);
		}
	}

	/**
	 * Do not run
	 * @param Client
	 * @param Animation
	 */
	@Client()
	private UpdateCurrent(Animation: InferredAnimation, Delta: number) {
		this.CalculateWeightAndSpeed(Animation);

		for (let i of $range(0, this.Controller.layerCount - 1)) {
			const Layer = this.AnimationController.WeightLayers[i as 0];
			Layer.Current = math.lerpClamped(Layer.Current, Layer.Target, 8 * Delta);

			this.Controller.SetLayerWeight(i, Layer.Current);
		}
	}

	@Client()
	public GetTransitions(Previous: SetAnimation, Animation: SetAnimation) {
		let [LastFrom, LastTo]: [number?, number?] = [undefined, undefined];
		let [NextFrom]: [number?, number?] = [undefined, undefined];

		/* 
            Order of priorities
            LastFrom -> New
            LastTo -> New
            NewFrom -> New
            NewTo -> New - triggers lastto -> new instead
        */

		if (Previous.Transitions) {
			if (Previous.Transitions.From) {
				LastFrom = Previous.Transitions.From.All;
			}

			if (Previous.Transitions.To) {
				LastTo = Previous.Transitions.To.All ?? Previous.Transitions.To[this.AnimationController.Current];
			}
		}

		if (Animation.Transitions) {
			if (Animation.Transitions.From) {
				NextFrom = Animation.Transitions.From.All ?? Animation.Transitions.From[this.AnimationController.Last];
			}
		}

		let TargetTime = NextFrom ?? LastTo ?? LastFrom;

		return TargetTime;
	}

	/**
	 * Change current Clients animation and update
	 * @param Client
	 */
	@Client()
	public Animate(DeltaTime: number) {
		const Previous = this.AnimationController.AnimList[this.AnimationController.Last] as SetAnimation;
		const Next = this.AnimationController.AnimList[this.AnimationController.Current] as SetAnimation;

		if (Previous !== Next) {
			this.AnimationController.Speed = 1;

			const TargetTime = this.GetTransitions(Previous, Next);

			this.UpdateState(Next, true, TargetTime);
			this.CalculateWeightAndSpeed(Next, true);

			this.AnimationController.Last = this.AnimationController.Current;
		}

		this.UpdateCurrent(Next, DeltaTime);
	}

	@Client()
	public GetRate() {
		const [_, Layer] = this.GetCurrentTrack(this.AnimationController.AnimList[this.AnimationController.Current]);
		const Clip = this.Controller.GetCurrentAnimatorStateInfo(Layer);

		return (Clip.speed * Clip.speedMultiplier) / Clip.length;
	}
}
