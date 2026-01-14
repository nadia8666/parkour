@CreateAssetMenu("Parkour/New Sound Bank", "Sound Bank.asset")
export default class SoundBankObject extends AirshipScriptableObject {
    @Header("Registry Info")
    public Name: string;
    public BankSize: number
}