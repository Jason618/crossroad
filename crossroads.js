/*
 *@describe  十字路口红绿灯，车，行人控制解决方案，前提是大家都遵守交通规则
 *@time 2016-2-26
 *@auth Jason
 ×@info	参与该十字路口的对象有车，行人，红绿灯，而红绿灯是一个起控制作用的”调度者“
 ×		车的直行，左转需要受红绿灯控制，右转不需要。
 ×		人只有在左右直行或者上下直行的时候才能左右或者上下通过马路；
 *		十字路口红绿灯控制分为movel2r(直行左右方向),turnLeftl2r(左转左右方向),moveu2d(直行上下方向),turnLeftu2d(左转上下方向);
*/
(function () {
	
	//pub sub简单实现
	var PubSub = (function () {
		var temp = {}
		topics = {},
			subUid = -1;
		temp.pub = function (topic, args) {
			if (!topics[topic]) {
				return;
			}
			var sub = topics[topic],
				len = sub.length;
			while (len--) {
				sub[len].func(topic, args);
			}
			return this;
		}
		temp.sub = function (topic, callback) {
			topics[topic] = topics[topic] ? topics[topic] : [];
			var token = (++subUid).toString();
			topics[topic].push({
				token: token,
				func: callback
			});
			return token;
		}
		return temp;
	})();

	//控制红绿灯显示
	var carLight = {
		targetLight: null,
		getLight: function (target) {
			var target = document.querySelectorAll("." + target);
			this.targetLight = target;
			return this;
		},
		showGreen: function (target) {
			for (var i = 0; i < target.length; i++) {
				target[i].querySelector(".greenbg").style.visibility = "visible";
				target[i].querySelector(".redbg").style.visibility = "hidden";
				target[i].querySelector(".yellowbg").style.visibility = "hidden";
			}
		},
		showRed: function (target) {
			for (var i = 0; i < target.length; i++) {
				var tempTarget = target[i];
				tempTarget.querySelector(".greenbg").style.visibility = "hidden";
				tempTarget.querySelector(".redbg").style.visibility = "visible";
				tempTarget.querySelector(".yellowbg").style.visibility = "hidden";
				/*
				//黄灯闪烁3秒后显示红灯
				this.showYellow(tempTarget,function(targetNode){
					console.info(targetNode);
					targetNode.querySelector(".redbg").style.visibility = "visible";
					targetNode.querySelector(".yellowbg").style.visibility = "hidden";
					PubSub.pub("changeStatus",targetNode);
				});
				*/
			}
		},
		showYellow: function (target, callback) {
			target.querySelector(".yellowbg").style.visibility = "visible";
			target.querySelector(".yellowbg").classList.add("flicker");
			if (callback && typeof callback == "function") {
				setTimeout(function () {
					callback(target);
				}, 3000);
			}
		}
	};
	
	//timer
	var carTimer = null;
	var carTimer2 = null;
	
	var Car = function (name, x, y, direction, controller) {
		this.name = name;
		this.x = x;
		this.y = y;
		this.direction = direction;
		this.controller = controller;
		this.init();
	}
	//车初始
	Car.prototype.init = function () {
		this.displayCar();
		this.carRun();
	}
	
	//将车显示在页面上
	Car.prototype.displayCar = function () {
		var name = this.name;
		var direction = this.direction;
		var carDiv = document.createElement("div");
		carDiv.classList.add("car");
		carDiv.classList.add(this.direction);
		carDiv.style.left = this.x + "px";
		carDiv.style.top = this.y + "px";
		carDiv.setAttribute("data-direction", this.direction);
		carDiv.setAttribute("id", name);
		document.getElementById("page").appendChild(carDiv);
	}
	
	Car.prototype.carRun = function () {
		var that = this;
		var carEle = document.getElementById(this.name);
		//carEle.classList.add("move");
		this.go();
		//this.stopBeforeFootwalkOrCross();
		PubSub.sub("changeStatus", function (topic, action) {
			that.stopBeforeFootwalkOrCross(topic, action);
		});
	}
	
	//车继续行驶
	Car.prototype.go = function () {
		var carEle = document.getElementById(this.name);
		var offsetLeft = carEle.offsetLeft;
		carTimer = setInterval(function () {
			carEle.style.left = offsetLeft + "px";
			console.info("go :" + offsetLeft);
			offsetLeft = offsetLeft + 2;
			if (offsetLeft > 800) {
				offsetLeft = 0;
			}
		}, 100);
	}
	//停车
	Car.prototype.stop = function () {
		if (carTimer) {
			clearInterval(carTimer);
		}
	}

	//车遇见红灯停下 还是通过
	Car.prototype.stopBeforeFootwalkOrCross = function (topic, action) {
		console.info(action);
		var myCar = document.getElementById(this.name);
		var offsetLeft = myCar.offsetLeft;
		//这里只处理这一种情况
		if (action.name == "直行左右方向") {
			// nothing
			clearInterval(carTimer);
			this.go();
		} else {

			if (offsetLeft > 200) {
				//车已经超过人行道线   车直接通过
			} else {
				this.stop();
				//车停在人行道前
				clearInterval(carTimer2);
				carTimer2 = setInterval(function () {
					if (offsetLeft < 200) {
						myCar.style.left = offsetLeft + "px";
						console.info("stopBeforeFootwalkOrCross :" + offsetLeft);
						offsetLeft = offsetLeft + 2;
					} else {
						if (carTimer2) {
							clearInterval(carTimer2);
						}
					}
				}, 100)
			}
		}
	}


	//转向对象
	var Action = function (name, time, lightDirection) {
		this.name = name;
		this.time = time;
		this.controller = null;
		this.lightTarget = lightDirection;
	}

	Action.prototype.go = function () {
		console.info(this.name + "可以通行" + this.time + "秒");
		document.getElementById("promptInfo").innerHTML = this.name + "可以通行" + this.time + "毫秒";
		var controller = this.controller;
		controller.currentAction = this;
		PubSub.pub("changeStatus", this);
		this.showLight(true);
		setTimeout(function () {
			//todo next
			if (controller.sign) {
				//执行下一个转向前调整之前的转向等状况;

				controller.currentAction.showLight(false);
				controller.next();
			}
		}, this.time);
	}
	Action.prototype.showLight = function (isTrue) {
		var target = this.lightTarget;
		var lightTarget = document.querySelectorAll("." + target);
		//如果没有设置灯
		if (!target) {
			return;
		}
		if (isTrue) {
			carLight.showGreen(lightTarget);
		} else {
			carLight.showRed(lightTarget);
		}
	}

	//红绿灯控制器
	var Controller = function () {
		this.currentAction = null; //当前转向
		this.sign = false; //工作状态
		this.actions = []; //所控制的转向
	}
	
	//注册可以直行的转向
	Controller.prototype.register = function (action) {
		this.actions.push(action);
		action.controller = this;
	}

	//执行下一步转向
	Controller.prototype.next = function () {
		var currentAction = this.currentAction;
		var next = this.actions.indexOf(currentAction) + 1;
		//红绿灯循环执行
		next = next == this.actions.length ? 0 : next;
		this.actions[next].go();

	}

	//运行
	Controller.prototype.run = function () {
			this.sign = true;
			//默认从第一个action开始,按注册顺序执行
			this.currentAction ? this.currentAction.go() : this.actions[0].go();
		}
		//停止
	Controller.prototype.stop = function () {
		this.sign = false;
	}

	Controller.prototype.fire = function (action) {
		this.sign = true;
		this.currentAction = action;
		action.go();

	}

	var movel2r = new Action("直行左右方向", "5000", "carLightV");
	var turnLeftl2r = new Action("左转左右方向", "2000");
	var moveu2d = new Action("直行上下方向", "5000", "carLightH");
	var turnLeftu2d = new Action("左转上下方向", "2000");

	var myController = new Controller();
	myController.register(movel2r);
	myController.register(turnLeftl2r);
	myController.register(moveu2d);
	myController.register(turnLeftu2d);
	myController.run();
	var car = new Car("myCar", 0, 300, "directionL2R", myController);
	//myController.stop();
	window.myController = myController;
})();