
const now = () => new Date().getTime();

/*
    Stats:
       * Goal: 
            A) Always have something to pop:
                * For every pop there should be a push,
                * For every push there should be a pop.
            B) Optimize processing speed:
                * Items should only pass to another queue, if 
                the destination queue has a higher estimates to finish
                its processing.
            C) Minimize items loss and floating
                * keep node passing to a minimal, so the probability 
                  of getting items passed infinitly, or items lost 
                  by broke comunications or crash. 

        * Goals Analysis:
            1g. Goal A) every node should have in queue at least two items,
            2g. Goal A) can't be garanted:
                * The number of processing items are lower than number of nodes,
                * Passing items to another queue is not adavantage (Goal B) 
            3g. From point 1 and 2 we can conclude that the number of items can't and 
                shouldn't be balanced on queues but instead finishing processing time 
                should be sincronized/balanced to all nodes.
            4g. Goal C)
                * From point 3 we need to balance finish estimates so this will restrict 
                  the number of items to be sent.
                * From point 1 we should consider that we have at least 4 neighbours,
                  this will make estimates divided by 5 nodes (couting with itself)
                * From point 1 and Goal A we can consider the avarage sending/requesting frequency rate
                  and calculate balance finish estimates asssuming that items will be sent in the future.
        
        * Procedures:
            + Requesting:
                * popAvgTime * NrOfNeighbours
                * minItemsToReceive = popAvgTime / (2 * pushAvgTime)

            + Sending:
                * FinishEstimate = QueueSizeA * popAvgTimeA
                * BalanceFinishEstimate = (((popAvgTimeA + popAvgTimeB) / 2) * QueueSizeA) / 5 [assume 5 nodes, Point 4g]
                    * PopAvgTime has to include sent items, mixing both local pop rate and remote pop rate.
                
                * TotalNrToSend = ROUND((BalanceFinishEstimate / FinishEstimate) * QueueSizeA)
                * NrToSend = TotalNrToSend / min 
                    * Where min = minItemsToReceive from requester

            + Node Stats:
                * popAvgTime
                * pushAvgTime

*/

class Queue {
    constructor() {
        this.queue = [];
        this.get = null;
        this.requesting = false;

        // Push Avg Time,
        this.pushCounter = 0;
        this.startPushTime = now();
        this.pushAvgTime;

        // Pop Avg Time,
        this.popCounter = 0;
        this.startPopTime;
    }
    
    setGet (get) {
        this.get = get;
    }

    push(...items) {
        this.pushCounter += items.length;

        const nowTime = now();
        const avg = (nowTime - this.startPushTime) / this.pushCounter;
        this.pushAvgTime = this.pushAvgTime?(this.pushAvgTime + avg) / 2:avg;

        console.log("-- Counter ", this.pushCounter, this.pushAvgTime);

        if (!this.startPopTime) {
            this.startPopTime = nowTime;
            this.startPushTime = nowTime;
            this.pushCounter = 0;
        }

        this.queue.push(...items);
    }
   
    pop () {
        const l = this.queue.length;

        const nowTime = now();

        if (this.startPopTime) {
            this.popCounter++;
            const avg = (nowTime - this.startPopTime) / this.popCounter;
            this.popAvgTime = this.popAvgTime?(this.popAvgTime + avg) / 2:avg;
        }

        let minItemsToReceive = 4;
        if (this.pushAvgTime) {
            if (this.pushAvgTime >= this.popAvgTime) {
                minItemsToReceive = Math.ceil((this.pushAvgTime / this.popAvgTime) * 2);
            }
        }

        console.log("------->", this.pushAvgTime, this.popAvgTime, l, minItemsToReceive);
        console.log(l, minItemsToReceive, !this.requesting);

        if (this.get && l <= minItemsToReceive && !this.requesting) {
            this.requesting = true;

            this.get(this.popAvgTime, minItemsToReceive);

            setInterval(() => this.requesting = false, 2000 );
        } 

        if (l === 0) {
            this.startPopTime = null;
            this.popCounter = 0;
        }
        else {
            return this.queue.pop();
        }
    }

    // TODO: make async pop that will wait if there is no elements to pop.

    requestPop (requestPopAvgTime=this.popAvgTime, min, nodes) {
        const l = this.queue.length;

        const finishEstimate = l * this.popAvgTime;
        const balanceFinishEstimate = (((this.popAvgTime + requestPopAvgTime) / 2) * l) / (nodes + 1);

        const totalNrToSend = Math.round((balanceFinishEstimate / finishEstimate) * l);
        
        console.log(`1. ${finishEstimate} = ${l} * ${this.popAvgTime}`);
        console.log(`2. ${balanceFinishEstimate} = (((${this.popAvgTime} + ${requestPopAvgTime}) / 2) * ${l}) / (${nodes} + 1)`);
        console.log(`3. ${totalNrToSend} = Math.round((${balanceFinishEstimate} / ${finishEstimate}) * ${l});`);


        if (totalNrToSend > 0) {
            const toSend = Math.round((min + totalNrToSend) / 2);
            // const toSend = Math.ceil(totalNrToSend / min);

            console.log(`4. ${toSend} = Math.round((${min} + ${totalNrToSend}) / 2)`);

            const items =  this.queue.splice(0, toSend);

            this.popCounter += items.length;

            if (this.startPopTime) {
                const nowTime = now();
                const avg = (nowTime - this.startPopTime) / this.popCounter;
                this.popAvgTime = this.popAvgTime?avg:(this.popAvgTime + avg) / 2;
            }

            return items;
        }
        else {
            return [];
        }
    }
}    

module.exports = {Queue};
