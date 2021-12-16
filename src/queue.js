class Queue {
    constructor() {
        this.queue = [];
        this.get = null;
        this.lastRequest = 0;
        this.startTime = new Date().getTime();
        this.processed = 0;
        this.avgProcessTime = 1000;
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

        this.processed++;
        if (this.processed >= 50 || l <= 1) {
            const now = new Date().getTime();
            this.avgProcessTime += (now - this.startTime) / this.processed;
            this.processed = 0; 
            this.startTime = now;
        }

        const estimatedTime = l * this.avgProcessTime;

        if (this.get && estimatedTime < 1000 * 30 && !this.requesting) {
            this.requesting = true;
            console.log("GET", estimatedTime);

            const elements = Math.floor((1000 * 30) / (estimatedTime || 100));

            console.log(elements);
            this.get(elements);

            setInterval(() => this.requesting = false, 2000);
        } 


        return this.queue.pop();
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
