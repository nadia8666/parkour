export default class testcomponent extends AirshipBehaviour {
    @Server()
    public FixedUpdate(dt: number) {
        this.transform.position = this.transform.position.add(new Vector3(0, 0, dt))
    }
}