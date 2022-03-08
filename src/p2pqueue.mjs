import PeerId  from 'peer-id'
import {pipe} from 'it-pipe'

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

export default class Queue {
    constructor (conn) {
        this.conn = conn;
        this.queue = [];
        this.pops = [];

        this.stats = {
            popTime: 0,
            popStartTime: 0,
            global: {
                avgFinishTime: 0,
                avgElements: 0
            }
        }

        this.conn.node.handle('/queue/1.0.0', async ({ connection, stream }) => {
            pipe(
              stream,
              source => (async () => {
                try {
                    for await (const msg of source) {
                        const data = JSON.parse(msg.toString());

                        if (data.sendElements) {
                            this.push(...data.sendElements);
                        }

                        const queueSize = this.queue.length;
                        const finishTime = queueSize * this.stats.popTime;
            
                        const {
                            avgElements=queueSize, 
                            avgFinishTime=finishTime
                        } = this.stats.global;
            
                        const elements = (avgElements + queueSize + data.elements) / 3;
                        const estimatedFinishTime = (avgFinishTime + finishTime + data.estimatedFinishTime) / 3;
            
                        this.stats.global = {
                            avgElements: elements,
                            avgFinishTime: estimatedFinishTime
                        };

                        // console.log(`got: ${(data.sendElements || []).length}, self: el=${queueSize}, time=${finishTime / (1000 * 60)}; global: el=${elements}, time=${estimatedFinishTime / (1000 * 60)}`);
                    }
                }
                catch (e) {
                  console.log(e);
                }
              })()
            );
        });

        this.broadcastID = setInterval(() => {
            const queueSize = this.queue.length;
            const {popTime} = this.stats;

            const finishTime = queueSize * popTime;

            const {
                avgElements=queueSize, 
                avgFinishTime=finishTime
            } = this.stats.global;

            const elements = (avgElements + queueSize) / 2;
            const estimatedFinishTime = (avgFinishTime + finishTime) / 2;

            this.stats.global = {
                avgElements: elements,
                avgFinishTime: estimatedFinishTime
            };

            const timePerc = (finishTime / estimatedFinishTime) - 1; 

            let sendElements;

            if (timePerc >= 0.1 && Object.keys(this.conn.connectedPeers).length > 0) {

                // calculate number of elements to send,

                // popTime * (queueSize - x) = serverFinishTime + x * servertPopTime
                // <=> popTime * queueSize - popTime * x - serverFinishTime - x * servertPopTime = 0
                // <=> finishTime - serverFinishTime - x * (popTime + serverPopTime) = 0
                // <=> -x = (serverFinishTime - finishTime) / (popTime + serverPopTime);
                // <=> x = (finishTime - serverFinishTime) / (popTime + serverPopTime);

                const serverPopTime = estimatedFinishTime / elements;
                const totalSendElements = Math.round((finishTime - estimatedFinishTime) / (popTime + serverPopTime));
                const elementsPerc = totalSendElements / queueSize;

                if (elementsPerc >= 0.1) {
                    sendElements = this.queue.splice(-totalSendElements, totalSendElements);
                }
            }

            this.send({
                elements,
                estimatedFinishTime
            }, sendElements);

        }, 2000);
    }

    get size () {
        return this.queue.length;            
    }

    async send (data, sendElements) {
        const peers = shuffle(Object.keys(this.conn.connectedPeers)).slice(0, 4);

        if (peers.length) {

            let elementsSplit = 0;
            if (sendElements) {
                elementsSplit = Math.ceil(sendElements.length / peers.length);
            }

            for (let i=0; i<peers.length; i++) {

                const peerId = PeerId.createFromB58String(peers[i]);
                const sendElementsSplit = sendElements && sendElements.length > 0 ? sendElements.splice(0, elementsSplit) : undefined;

                try {
                    const { stream } = await this.conn.node.dialProtocol(peerId, '/queue/1.0.0')


                    await pipe(
                        [
                            JSON.stringify({
                                ...data, 
                                sendElements: sendElementsSplit
                            })
                        ],
                        stream
                    );
                }
                catch (e) {
                    if (sendElementsSplit) {
                        this.push(...sendElementsSplit);
                    }

                    delete this.conn.connectedPeers[peers[i]];
                }
            }
        }
        else {
            // put elements back,
            if (data.sendElements) {
                this.push(...data.sendElements);
            }
        }
    }

    push (...args) {
        this.stats.popStartTime = this.stats.popStartTime || new Date().getTime();

        this.queue.push(...args);
        this.flush();
    }

    popStats () {
        const timeDiff = new Date().getTime() - this.stats.popStartTime; 
        this.stats.popTime = this.stats.popTime ? (this.stats.popTime + timeDiff) / 2 : timeDiff;
        this.stats.popStartTime = new Date().getTime();

        if (this.queue.length === 0) {
            this.stats.popStartTime = 0;
        }
    }

    flush () {
        while (this.queue.length && this.pops.length) {
            const e = this.queue.pop();
            const c = this.pops.pop();

            this.popStats();

            c(e);
        }

        if (this.queue.length === 0) {
            this.stats.popStartTime = 0;
        }
    }

    async pop (timeout) {
        const e = this.queue.pop();

        if (e !== undefined) {
            this.popStats();
            return e;
        }

        return new Promise(
            (resolve, reject) => {
                let call = resolve;

                if (timeout) {
                    const timeoutID = setTimeout(
                        () => {
                            const index = this.pops.indexOf(resolve);

                            if (index !== -1) {
                                this.pops.splice(index, 1);
                            } 

                            reject('Pop Timeout');
                        }, timeout
                    )

                    call = item => {
                        clearTimeout(timeoutID);
                        resolve(item);
                    }
                }

                this.pops.push(resolve);
            }
        )
    }

    close () {
        clearInterval(this.broadcastID);
        this.conn.node.unhandle('/queue/1.0.0');
    }

}
