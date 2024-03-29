define(["avalon"], function(avalon) {
//chrome36的原生Promise还多了一个defer()静态方法，允许不通过传参就能生成Promise实例，
//另还多了一个chain(onSuccess, onFail)原型方法，意义不明
//目前，firefox24, opera19也支持原生Promise(chrome32就支持了，但需要打开开关，自36起直接可用)
//本模块提供的Promise完整实现ECMA262v6 的Promise规范
    var Promise = function(executor) {
        this._callbacks = []
        var that = this
        if (typeof this !== 'object')
            throw new TypeError('Promises must be constructed via new')
        if (typeof executor !== 'function')
            throw new TypeError('not a function')
        executor(function(value) {
            _resolve(that, value)
        }, function(reason) {
            _reject(that, reason)
        })
    }
    var setImmediate = typeof window.setImmediate === "function" ? function(fn) {
        window.setImmediate(fn)
    } : function(fn) {
        window.setTimeout(fn, 0)
    }
    //返回一个已经处于`resolved`状态的Promise对象
    Promise.resolve = function(value) {
        return new Promise(function(resolve) {
            resolve(value)
        })
    }
    //返回一个已经处于`rejected`状态的Promise对象
    Promise.reject = function(reason) {
        return new Promise(function(resolve, reject) {
            reject(reason)
        })
    }

    Promise.prototype = {
        //一个Promise对象一共有3个状态：
        //- `pending`：还处在等待状态，并没有明确最终结果
        //- `resolved`：任务已经完成，处在成功状态
        //- `rejected`：任务已经完成，处在失败状态
        constructor: Promise,
        _state: "pending",
        _fired: false, //判定是否已经被触发
        _fire: function(onSuccess, onFail) {
            if (this._state === "rejected") {
                if (typeof onFail === "function") {
                    onFail(this._value)
                } else {
                    throw this._value
                }
            } else {
                if (typeof onSuccess === "function") {
                    onSuccess(this._value)
                }
            }
        },
        _then: function(onSuccess, onFail) {
            if (this._fired) {//在已有Promise上添加回调
                var that = this
                setImmediate(function() {
                    that._fire(onSuccess, onFail)
                });
            } else {
                this._callbacks.push({onSuccess: onSuccess, onFail: onFail})
            }
        },
        then: function(onSuccess, onFail) {
            var parent = this//在新的Promise上添加回调
            return new Promise(function(resolve, reject) {
                parent._then(function(value) {
                    if (typeof onSuccess === "function") {
                        try {
                            value = onSuccess(value)
                        } catch (e) {
                            reject(e)
                            return
                        }
                    }
                    resolve(value)
                }, function(value) {
                    if (typeof onFail === "function") {
                        try {
                            value = onFail(value)
                        } catch (e) {
                            reject(e)
                            return
                        }
                        resolve(value)
                    } else {
                        reject(value)
                    }
                })
            })
        },
        "catch": function(onFail) {//添加错误回调
            return this.then(null, onFail)
        },
        done: function(onSuccess) {//添加与jQuery相仿的API
            return this.then(onSuccess)
        },
        fail: function(onFail) {//添加与jQuery相仿的API
            return this.then(null, onFail)
        }
    }
    function _resolve(promise, value) {//触发成功回调
        if (promise._state !== "pending")
            return;
        promise._state = "fulfilled"
        if (value && typeof value.then === "function") {
            //thenable对象使用then，Promise实例使用_then
            var method = value instanceof Promise ? "_then" : "then"
            value[method](function(val) {
                _transmit(promise, val)
            }, function(reason) {
                promise._state = "rejected"
                _transmit(promise, reason)
            });
        } else {
            _transmit(promise, value);
        }
    }
    function _reject(promise, value) {//触发失败回调
        if (promise._state !== "pending")
            return
        promise._state = "rejected"
        _transmit(promise, value)
    }
    //改变Promise的_fired值，并保持用户传参，触发所有回调
    function _transmit(promise, value) {
        promise._fired = true;
        promise._value = value;
        setImmediate(function() {
            promise._callbacks.forEach(function(data) {
                promise._fire(data.onSuccess, data.onFail);
            })
        })
    }
    function _some(any, promises) {
        var n = 0, result = [], end
        return new Promise(function(resolve, reject) {
            function loop(promise, index) {
                promise.then(function(ret) {
                    if (!end) {
                        result[index] = ret//保证回调的顺序
                        n++
                        if (any || n >= promises.length) {
                            resolve(any ? ret : result)
                            end = true
                        }
                    }
                }, function(e) {
                    end = true
                    reject(e)
                })
            }
            for (var i = 0, l = promises.length; i < l; i++) {
                loop(promises[i], i)
            }
        })
    }

    Promise.all = function() {
        return _some(false, arguments)
    }
    Promise.race = function() {
        return _some(true, arguments)
    }

    var nativePromise = window.Promise
    if (/native code/.test(window.Promise)) {
        nativePromise.prototype.done = Promise.prototype.done
        nativePromise.prototype.fail = Promise.prototype.fail
        nativePromise.any = nativePromise.race
    } else {
        Promise.any = Promise.race
        window.Promise = Promise
    }
    avalon.mmPromise = Promise
    return avalon
})
//https://github.com/ecomfe/er/blob/master/src/Deferred.js
//http://jser.info/post/77696682011/es6-promises
