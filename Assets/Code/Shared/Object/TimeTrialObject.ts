@CreateAssetMenu("Parkour/New Time Trial", "Time Trial.asset")
export default class TimeTrialObject extends AirshipScriptableObject {
	@Header("Registry Info")
	public ID: string;
	public DisplayName: string;

	public Bronze: number;
	public Silver: number;
	public Gold: number;
	public Platinum: number;

	public GetTimesOrdered() {
		return [this.Platinum, this.Gold, this.Silver, this.Bronze];
	}

	public GetRank(Time: number) {
		let Rank = 0;

		const Times = this.GetTimesOrdered();
		for (const [RankID, TargetTime] of pairs(Times)) {
			const Last = Times[RankID - 2];
			if (Last !== undefined) {
				if (Time < TargetTime && Time > Last) {
					Rank = RankID;
					break;
				}
			} else if (Time < TargetTime) {
				Rank = RankID;
				break;
			}
		}

		return Rank;
	}

	public GetRankDisplayFromRank(Rank: number) {
		switch (Rank) {
			case 1:
				return "Platinum";
			case 2:
				return "Gold";
			case 3:
				return "Silver";
			case 4:
				return "Bronze";
			default:
				return "NONE";
		}
	}
	public GetRankDisplayFromTime(Time: number) {
		return this.GetRankDisplayFromRank(this.GetRank(Time));
	}

	public GetColorFromRank(Rank: number) {
		return [new Color(0.827, 0.89, 1), new Color(0.98, 0.859, 0.157), new Color(0.761, 0.761, 0.761), new Color(0.788, 0.478, 0.09)][Rank - 1] ?? new Color(0, 0, 0);
	}

	public GetColorFromTime(Time: number) {
		return this.GetColorFromRank(this.GetRank(Time));
	}
}
