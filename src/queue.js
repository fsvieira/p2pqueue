class Queue {
    constructor() {
        this.queue = [];
        this.get = null;
        this.lastRequest = 0;
        this.startTime = new Date().getTime();
        this.processed = 0;
        this.avgProcessTime;
        this.requesting = false;
    }
    
    setGet (get) {
        this.get = get;
    }

    push(...items) {
        this.queue.push(...items);
    }
    
    pop () {
        const l = this.queue.length;

        const now = new Date().getTime();

        if (this.lastTimePop) {
            if (this.avgProcessTime) {
                this.avgProcessTime = (this.avgProcessTime + now - this.lastTimePop) / 2;
            }
            else {
                this.avgProcessTime = now - this.lastTimePop;
            }
        }

        const estimatedTime = l * this.avgProcessTime || 1000;

        console.log(`AVG Process Time ${this.avgProcessTime}, Estimated Finish Time ${estimatedTime}`);

        if (this.get && estimatedTime < 1000 * 30 && !this.requesting) {
            this.requesting = true;
            console.log("GET", estimatedTime);

            const elements = Math.ceil(((1000 * 30) / (estimatedTime || 100)) * 1.20);

            console.log(elements);
            this.get(elements);

            const wait = estimatedTime * 0.5;
            setInterval(() => this.requesting = false, wait < 2000 ? 2000: wait );
        } 

        if (l === 0) {
            this.lastTimePop = null;
        }
        else {
            this.lastTimePop = now;
            return this.queue.pop();
        }
    }

    requestPop (n) {
        const l = this.queue.length;

        const estimatedTime = l * this.avgProcessTime;
        const elements = Math.floor((1000 * 30) / (estimatedTime || 100));
        const toSend = l - elements;

        return this.queue.splice(0, toSend > n?n:toSend);
    }
}    

module.exports = {Queue};
