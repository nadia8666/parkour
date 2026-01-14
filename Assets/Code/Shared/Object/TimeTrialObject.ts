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
        return [this.Platinum, this.Gold, this.Silver, this.Bronze]
    }
    
    public GetRank(Time: number) {
        let Rank = 0

        const Times = this.GetTimesOrdered()
        for (const [RankID, TargetTime] of pairs(Times)) {
            const Last = Times[RankID-2]
            if (Last !== undefined) {
                if (Time < TargetTime && Time > Last) {
                    Rank = RankID
                    break
                }
            } else if (Time < TargetTime) {
                Rank = RankID
                break
            }
        }

        return Rank
    }

    public GetColor(Rank: number) {
        return [
            Color.white,
            Color.yellow,
            Color.grey,
            Color.magenta
        ][Rank-1] ?? new Color(0, 0, 0)
    }
}
