'use strict';

window.AudioContext = window.AudioContext || window.webkitAudioContext;

(function(exports, models, sounds)
{
	function preloadAssets(cb)
	{
		var textures = {};

		// kick off preloading
		loadTextures(function(){ loadModels(cb); });
		loadSounds(); // note: sound loading is non-blocking unlike models

		function loadTextures(cb)
		{
			var textureLoader = new THREE.TextureLoader();
			var texturesToGo = 6;

			textureLoader.load('/static/models/box.png', function(tex){
				textures.box = tex;
				if(--texturesToGo === 0) cb();
			});

			textureLoader.load('/static/models/leftao.png', function(tex){
				textures.confettiLeftAO = tex;
				if(--texturesToGo === 0) cb();
			});

			textureLoader.load('/static/models/rightao.png', function(tex){
				textures.confettiRightAO = tex;
				if(--texturesToGo === 0) cb();
			});

			textureLoader.load('/static/check.png', function(tex){
				textures.check = tex;
				if(--texturesToGo === 0) cb();
			});

			textureLoader.load('/static/cross.png', function(tex){
				textures.cross = tex;
				if(--texturesToGo === 0) cb();
			});

			textureLoader.load('/static/suggestion.png', function(tex){
				window.suggestionTexture = tex;
				if(--texturesToGo === 0) cb();
			});
		}

		function loadModels(cb)
		{
			var modelLoader = new THREE.ColladaLoader();
			var modelsToGo = 5;

			// pre-load card model
			modelLoader.load('/static/models/card.dae', function(result)
			{
				models.card = result.scene.children[0].children[0];
				models.card.scale.set(2,2,2);

				models.blankCard = generateCard({text:''});

				if(--modelsToGo === 0) cb();
			});

			// preload nameplate model
			modelLoader.load('/static/models/nameplate.dae', function(result)
			{
				models.nameplate = result.scene.children[0].children[0];
				models.nameplate.scale.set(2,2,2);

				if(--modelsToGo === 0) cb();
			});

			modelLoader.load('/static/models/box.dae', function(result)
			{
				models.box = result.scene.children[0].children[0];
				models.box.scale.set(2,2,2);
				models.box.material = new THREE.MeshBasicMaterial({map: textures.box});

				if(--modelsToGo === 0) cb();
			});

			modelLoader.load('/static/models/dialog.dae', function(result)
			{
				models.dialog = result.scene.children[0];

				if(--modelsToGo === 0) cb();
			});

			modelLoader.load('/static/models/confettiball.dae', function(results)
			{
				models.confettiBall = results.scene.children[0];
				models.confettiBall.getObjectByName('left').children[0].material = new THREE.MeshBasicMaterial({
					map: textures.confettiLeftAO, side: THREE.DoubleSide
				});
				models.confettiBall.getObjectByName('right').children[0].material = new THREE.MeshBasicMaterial({
					map: textures.confettiRightAO, side: THREE.DoubleSide
				});

				if(--modelsToGo === 0) cb();
			});

			// generate models for confirmation boxes
			models.yesBox = new THREE.Mesh(
				new THREE.BoxGeometry(0.01, 0.1, 0.1),
				new THREE.MeshBasicMaterial({
					map: textures.check
				})
			);

			models.noBox = new THREE.Mesh(
				new THREE.BoxGeometry(0.01, 0.1, 0.1),
				new THREE.MeshBasicMaterial({
					map: textures.cross
				})
			);
		}

		function loadSound(url, cb)
		{
			var xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'arraybuffer';
			xhr.onload = function()
			{
				if(xhr.status === 200 || xhr.status === 304){
					sounds.ctx.decodeAudioData(xhr.response,
						function(buffer){
							var gainNode = sounds.ctx.createGain();
							gainNode.connect(sounds.masterVol);
							cb(buffer, gainNode);
						},
						function(err){
							console.error('Failed to decode', url);
						}
					);
				}
			};
			xhr.send();
		}

		function loadSounds()
		{
			// set up sound subsystem
			sounds.ctx = new AudioContext();
			sounds.masterVol = sounds.ctx.createGain();
			sounds.masterVol.connect(sounds.ctx.destination);
			sounds.masterVol.gain.value = 0.25;

			// load confetti sound
			loadSound('/static/audio/fanfare with pop.ogg', function(source, volumeControl)
			{
				sounds.fanfare = source;
				sounds.fanfareVol = volumeControl;
			});

			// load ding sound
			loadSound('/static/audio/ding ding.ogg', function(source, volumeControl)
			{
				sounds.ding = source;
				sounds.dingVol = volumeControl;
			});

			// load card sound
			loadSound('/static/audio/card_flick.ogg', function(source, volumeControl)
			{
				sounds.card = source;
				sounds.cardVol = volumeControl;
			});
		}
	}
	
	sounds.playSound = function(soundName)
	{
		var source = sounds.ctx.createBufferSource();
		source.buffer = sounds[soundName];
		source.connect( sounds[soundName+'Vol'] );
		
		if(soundName === 'fanfare')
			source.start(0, 1.4);
		else
			source.start(0);
	}

	// ugh, nasty hack
	if( /AltspaceVR-App build-[0-9a-f]{7} Mobile/.test(window.navigator.userAgent) ){
		var fontScale = 0.85;
	}
	else {
		fontScale = 1.0;
	}

	function makeSafeFont(g, text, maxWidth)
	{
		// get pixel width of longest line
		var textWidth = Math.max.apply(null, text.map(function(s){return g.measureText(s).width;}));

		// if longest line is longer than specified max width
		if( textWidth > maxWidth )
		{
			// scale down font to bring width down to maxWidth
			var font = g.font;
			var fontSize = /[0-9.]+px/.exec(font)[0];
			var fontSizeValue = parseFloat(fontSize);
			fontSizeValue = (maxWidth/textWidth) * fontSizeValue;
			font = font.replace(fontSize, fontSizeValue+'px');

			g.font = font;
		}
	}

	function generateCard(card, color)
	{
		if(color === 'black'){
			var fgColor = '#eee';
			var bgColor = 'black';
		}
		else {
			fgColor = 'black';
			bgColor = '#eee';
		}

		// card face texture resolution
		var cardWidth = 256;
		var model = models.card.clone();
		var fontStack = '"Helvetica Neue", Helvetica, Arial, Sans-Serif';

		// set up canvas
		var bmp = document.createElement('canvas');
		var g = bmp.getContext('2d');
		bmp.width = 2*cardWidth;
		bmp.height = 2*cardWidth;
		g.fillStyle = bgColor;
		g.fillRect(0, 0, 2*cardWidth, 2*cardWidth);
		g.fillStyle = fgColor

		// write text
		g.textAlign = 'left';
		g.font = 'bold '+(0.09*cardWidth*fontScale)+'px '+fontStack;
		var text = card.text.split('\n');
		makeSafeFont(g, text, 0.84*cardWidth);
		for(var i=0; i<text.length; i++){
			g.fillText(text[i], 0.08*cardWidth, (0.15+0.12*i)*cardWidth);
		}

		// draw "PICK X" indicator
		if(card.numResponses)
		{
			g.font = 'bold '+(0.07*cardWidth*fontScale)+'px '+fontStack;
			makeSafeFont(g, ['PICK 2'], 0.25*cardWidth);
			g.textAlign = 'right';
			g.fillText('PICK', 0.85*cardWidth, 1.33*cardWidth);

			g.beginPath();
				g.arc(0.91*cardWidth, 1.303*cardWidth, 0.04*cardWidth, 0, 2*Math.PI);
			g.closePath();
			g.fill();
			g.textAlign = 'center';
			g.fillStyle = bgColor;
			g.fillText(card.numResponses, 0.91*cardWidth, 1.33*cardWidth);

			g.fillStyle = fgColor;
			g.textAlign = 'left';
		}

		// draw "DRAW X" indicator
		if(card.numDraws)
		{
			g.font = 'bold '+(0.07*cardWidth*fontScale)+'px '+fontStack;
			makeSafeFont(g, ['DRAW 2'], 0.3*cardWidth);
			g.textAlign = 'right';
			g.fillText('DRAW', 0.85*cardWidth, 1.22*cardWidth);

			g.beginPath();
				g.arc(0.91*cardWidth, 1.192*cardWidth, 0.04*cardWidth, 0, 2*Math.PI);
			g.closePath();
			g.fill();
			g.textAlign = 'center';
			g.fillStyle = bgColor;
			g.fillText(card.numDraws, 0.91*cardWidth, 1.22*cardWidth);

			g.fillStyle = fgColor;
			g.textAlign = 'left';
		}


		// draw logo
		var edgeLength = 1/16*cardWidth;
		var x = 0.08*cardWidth, y = 1.33*cardWidth;
		g.lineWidth = 2;
		g.strokeStyle = fgColor;
		g.moveTo(x, y);
		g.lineTo(x+edgeLength/2, y-edgeLength*Math.sin(Math.PI/3));
		g.lineTo(x+edgeLength, y);
		g.moveTo(x+edgeLength/4, y);
		g.lineTo(x+3*edgeLength/4, y);
		g.stroke();

		// draw footer
		g.textAlign = 'left';
		g.font = (0.05*cardWidth*fontScale)+'px '+fontStack;
		if( card.creator ){
			g.fillText(card.creator, x+1.5*edgeLength, y);
		}
		else if( card.numResponses || card.numDraws ){
			g.fillText("HAH", x+1.5*edgeLength, y);
		}
		else {
			makeSafeFont(g, ['Holograms Against Humanity'], .6525*cardWidth);
			g.fillText("Holograms Against Humanity Daves", x+1.5*edgeLength, y);
		}

		// draw card back
		g.font = 'bold '+(0.15*cardWidth*fontScale)+'px '+fontStack;
		makeSafeFont(g, ['Holograms','Against','Humanity','Daves','Unofficial'], 0.8*cardWidth);
		g.fillText('Holograms', 1.1*cardWidth, 0.22*cardWidth);
		g.fillText('Against', 1.1*cardWidth, 0.37*cardWidth);
		g.fillText('Humanity', 1.1*cardWidth, 0.52*cardWidth);
		g.fillText('Daves', 1.1*cardWidth, 0.67*cardWidth);
		g.fillText('Unofficial', 1.1*cardWidth, 0.82*cardWidth);

		// assign texture
		model.material = new THREE.MeshBasicMaterial({
			map: new THREE.CanvasTexture(bmp)
		});

		model.userData = card;
		return model;
	}

	function generateTitleCard()
	{
		// card face texture resolution
		var cardWidth = 256;
		var model = models.card.clone();
		var fontStack = '"Helvetica Neue", Helvetica, Arial, Sans-Serif';

		// set up canvas
		var bmp = document.createElement('canvas');
		var g = bmp.getContext('2d');
		bmp.width = 2*cardWidth;
		bmp.height = 2*cardWidth;
		g.fillStyle = 'black';
		g.fillRect(0, 0, 2*cardWidth, 2*cardWidth);

		// draw card
		g.font = 'bold '+(0.15*cardWidth*fontScale)+'px '+fontStack;
		makeSafeFont(g, ['Holograms','Against','Humanity','Daves','Unofficial'], 0.8*cardWidth);
		g.fillStyle = 'white';

		g.fillText('Holograms', 0.1*cardWidth, 0.22*cardWidth);
		g.fillText('Against', 0.1*cardWidth, 0.37*cardWidth);
		g.fillText('Humanity', 0.1*cardWidth, 0.52*cardWidth);
		g.fillText('Daves', 0.1*cardWidth, 0.67*cardWidth);
		g.fillText('Unofficial', 0.1*cardWidth, 0.82*cardWidth);

		g.fillText('Holograms', 1.1*cardWidth, 0.22*cardWidth);
		g.fillText('Against', 1.1*cardWidth, 0.37*cardWidth);
		g.fillText('Humanity', 1.1*cardWidth, 0.52*cardWidth);
		g.fillText('Daves', 1.1*cardWidth, 0.67*cardWidth);
		g.fillText('Unofficial', 1.1*cardWidth, 0.82*cardWidth);

		g.font = 'bold '+(0.05*cardWidth*fontScale)+'px '+fontStack;
		var legal = [
			'© Cards Against Humanity LLC',
			'Licensed under CC BY-NC-SA',
			'cardsagainsthumanity.com',
			'Adapted for AltspaceVR by:',
			'StevenPatrick, falkrons, schmidtec'];
		makeSafeFont(g, legal, 0.86*cardWidth);
		for(var i=0; i<legal.length; i++){
			g.fillText(legal[i], 0.07*cardWidth, (1.06 + 0.07*i)*cardWidth);
			g.fillText(legal[i], 1.07*cardWidth, (1.06 + 0.07*i)*cardWidth);
		}

		// assign texture
		model.material = new THREE.MeshBasicMaterial({
			map: new THREE.CanvasTexture(bmp)
		});

		return model;
	}

	function generateNameplate(name)
	{
		// card face texture resolution
		var texWidth = 256;
		var model = models.nameplate.clone();
		var fontStack = '"Helvetica Neue", Helvetica, Arial, Sans-Serif';

		// set up canvas
		var bmp = document.createElement('canvas');
		var g = bmp.getContext('2d');
		bmp.width = texWidth;
		bmp.height = texWidth;

		if(name === Game.playerInfo.displayName)
			g.fillStyle = '#541E1E'; // brick red
		else
			g.fillStyle = '#38281C'; // neutral brown
		g.fillRect(0, 0, texWidth, texWidth);

		g.font = 'bold '+(0.1*texWidth*fontScale)+'px '+fontStack;
		makeSafeFont(g, [name], 0.9*texWidth);
		g.textAlign = 'center';
		g.fillStyle = 'white';
		g.fillText(name, texWidth/2, 35);
		g.fillText(name, texWidth/2, 86);

		// assign texture
		model.material = new THREE.MeshBasicMaterial({
			map: new THREE.CanvasTexture(bmp)
		});

		return model;
	}

	function generateDialog(text, acceptCb, declineCb, finallyCb)
	{
		// card face texture resolution
		var texWidth = 512;
		var model = models.dialog.clone();
		var fontStack = '"Helvetica Neue", Helvetica, Arial, Sans-Serif';

		// set up canvas
		var bmp = document.createElement('canvas');
		var g = bmp.getContext('2d');
		bmp.width = texWidth;
		bmp.height = texWidth;

		// draw background
		g.fillStyle = 'whitesmoke';
		g.fillRect(0, 0, texWidth, texWidth-160);
		g.fillStyle = 'red';
		g.fillRect(0, texWidth-166, texWidth/2, 160);
		g.fillStyle = 'green';
		g.fillRect(texWidth/2, texWidth-160, texWidth/2, 160);

		// set up text
		g.font = 'bold 35px '+fontStack;
		g.textAlign = 'center';
		g.fillStyle = 'black';

		// draw question
		var lines = text.split('\n');
		for(var i=1; i<=lines.length; i++)
			g.fillText(lines[i-1], texWidth/2, 50*i + 50);

		// draw answers
		g.font = 'bold 45px '+fontStack;
		g.fillText('No', 0.25*texWidth, texWidth-70);
		g.fillText('Yes', 0.75*texWidth, texWidth-70);

		// assign texture
		var dMaterial = new THREE.MeshBasicMaterial({
			map: new THREE.CanvasTexture(bmp)
		});
		model.traverse(function(mesh){
			mesh.material = dMaterial;
		});

		// assign callbacks
		model.getObjectByName('Accept').addEventListener('cursorup', function(){
			if(acceptCb) acceptCb();
			if(finallyCb) finallyCb();
			model.parent.remove(model);
		});
		model.getObjectByName('Decline').addEventListener('cursorup', function(){
			if(declineCb) declineCb();
			if(finallyCb) finallyCb();
			model.parent.remove(model);
		});


		// point dialog at player
		var seat = root.getObjectByName(Game.playerInfo.id);
		model.applyMatrix( sphericalToMatrix(0, Math.PI/8, 1.05*tableRadius, 'yzx') );
		seat.add(model);

		sounds.playSound('ding');
		
		return model;
	}

	function sphericalToMatrix(theta, phi, radius, basis)
	{
		// basis is ["forward" axis, "up" axis, "side" axis]
		if(!basis || !/^[xyz]{3}$/.test(basis)) basis = 'zyx';

		// determine position
		var x = radius * Math.cos(phi) * Math.sin(theta);
		var y = radius * Math.cos(phi) * Math.cos(theta);
		var z = radius * Math.sin(phi);

		// determine rotation
		var basisMap = {};
		basisMap[basis[0]] = new THREE.Vector3(-x, -y, -z).normalize();
		var temp = new THREE.Vector3().crossVectors( basisMap[basis[0]], new THREE.Vector3(0,0,1) ).normalize();
		basisMap[basis[1]] = new THREE.Vector3().crossVectors( temp, basisMap[basis[0]] );
		basisMap[basis[2]] = basis[0] < basis[1] ? temp : temp.negate();

		// combine into matrix
		var mat = new THREE.Matrix4();
		mat.makeBasis( basisMap.x, basisMap.y, basisMap.z );
		mat.setPosition( new THREE.Vector3(x, y, z) );

		return mat;
	}

	function rebalanceTable(newTurnOrder, oldTurnOrder, newPlayerId)
	{
		newTurnOrder = newTurnOrder || [];
		oldTurnOrder = oldTurnOrder || [];

		var angle = 2*Math.PI/newTurnOrder.length;
		var players = newTurnOrder.map(function(e){return e.id;});

		// add new players, adjust old players
		for(var i=0; i<newTurnOrder.length; i++)
		{
			// attempt to get seat at index
			var seat = root.getObjectByName(newTurnOrder[i].id);
			if(seat)
			{
				// player is already in the game, move them to position
				seat.addBehavior( new Behaviors.Animate(
					null,
					new THREE.Vector3(-1.05*tableRadius*Math.sin(i*angle), -1.05*tableRadius*Math.cos(i*angle), 1.5),
					new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), -angle*i)
				));

				// add a kick handler if the seat was added before the current player joined
				if( Game.playerInfo.id === newPlayerId )
				{
					// register "Kick" action
					(function(nameplate, opponentInfo){
						nameplate.addEventListener('cursorup', function(evt)
						{
							generateDialog('Do you want to kick\n'+opponentInfo.displayName+'?', function(){
								console.log('kicking');
								socket.emit('playerKickRequest', opponentInfo.id, opponentInfo.displayName);
							});
						});
					})(seat.getObjectByName('nameplate'), newTurnOrder[i]);
				}
			}
			else
			{
				// create new seat for player
				seat = new THREE.Object3D();
				seat.name = newTurnOrder[i].id;
				seat.position.set(-1.05*tableRadius*Math.sin(i*angle), -1.05*tableRadius*Math.cos(i*angle), 1.5);
				seat.rotation.set(0, 0, -angle*i);

				// add nameplate for the player
				var nameplate = generateNameplate(newTurnOrder[i].displayName);
				nameplate.name = 'nameplate';
				nameplate.position.set(0, 0.25, -0.64);
				nameplate.rotation.set(0, 0, Math.PI/2);
				nameplate.addBehavior( new Behaviors.CursorFeedback() );
				seat.add(nameplate);

				// add presentation space
				var center = new THREE.Object3D();
				center.name = 'presentation';
				center.position.set(0, 1.05*tableRadius, 1);
				center.rotation.set(0, 0, Math.PI);
				center.scale.set(6,6,6);
				seat.add(center);

				// handle "leave" on self click
				if(newTurnOrder[i].id === Game.playerInfo.id)
				{
					// register "Leave" action
					nameplate.addEventListener('cursorup', function(evt)
					{
						generateDialog('Are you sure you want to\nleave the game?', function()
						{
							socket.emit('playerLeave', Game.playerInfo.id, Game.playerInfo.displayName,
								Game.playerInfo.displayName+' has left the game.'
							);
						});
					});
				}

				// handle "kick" if still a player
				else if(players.indexOf(Game.playerInfo.id) > -1)
				{
					// register "Kick" action
					(function(nameplate, opponentInfo){
						nameplate.addEventListener('cursorup', function(evt)
						{
							generateDialog('Do you want to kick\n'+opponentInfo.displayName+'?', function(){
								console.log('kicking');
								socket.emit('playerKickRequest', opponentInfo.id, opponentInfo.displayName);
							});
						});
					})(nameplate, newTurnOrder[i]);
				}

				var cardRadius = 0.5, row1Angle = Math.PI/5, row2Angle = Math.PI/3,
					row1Sep = Math.PI/10, row2Sep = 1.5*Math.PI/10;

				// set card positions
				for(var j=0; j<12; j++)
				{
					if(j<5){
						var theta = (j-2)*row1Sep;
						var phi = -row1Angle;
					}
					else if(j < 10){
						theta = (j-7)*row2Sep;
						phi = -row2Angle;
					}
					else if(j === 10){
						theta = -3*row1Sep;
						phi = -row1Angle;
					}
					else if(j === 11){
						theta = 3*row1Sep;
						phi = -row1Angle;
					}

					// place card
					var card = new THREE.Object3D();
					card.name = 'card'+j;
					card.applyMatrix( Utils.sphericalToMatrix(theta, phi, cardRadius, 'zyx') );
					seat.add(card);

					// add hover feedback to your own cards
					if(newTurnOrder[i].id === Game.playerInfo.id)
						card.addBehavior( new Behaviors.CursorFeedback() );
				}

				// add seat to the table
				root.add(seat);
			}
		}

		// remove absent players
		for(var i=0; i<oldTurnOrder.length; i++)
		{
			// determine if old player is in new turn order
			for(var j=0, playerIn=false; j<newTurnOrder.length && !playerIn; j++){
				playerIn = playerIn || newTurnOrder[j].id === oldTurnOrder[i].id;
			}

			if(!playerIn){
				var seat = root.getObjectByName(oldTurnOrder[i].id);
				root.remove(seat);
			}
		}


	}

	//add Idle "are you still there "timeout
	var idleTimeout = {};
	var kickTimeout = {};
	var idleCheck = function (){
		idleTimeout = setTimeout(function(){
        	clearTimeout(idleTimeout);
        	generateDialog('AFK WARNING\nAre you there?', idleClear , function(){
				socket.emit('playerLeave', Game.playerInfo.id, Game.playerInfo.displayName,
				Game.playerInfo.displayName+' has left the game.');
			});
        	kickTimeout = setTimeout(function(){
        		clearTimeout(kickTimeout);
        		Game.emitPlayerLeave();
        		console.log("you have been kicked from the game due to inactivity.");
    		}, 60000);
    	}, 300000);
    }
    var idleClear = function (){
    	clearTimeout(kickTimeout);
    	clearTimeout(idleTimeout);
    }


	exports.preloadAssets = preloadAssets;
	exports.generateCard = generateCard;
	exports.generateTitleCard = generateTitleCard;
	exports.generateNameplate = generateNameplate;
	exports.generateDialog = generateDialog;
	exports.sphericalToMatrix = sphericalToMatrix;
	exports.rebalanceTable = rebalanceTable;
	exports.idleCheck = idleCheck;
	exports.idleClear = idleClear;
})(window.Utils = window.Utils || {}, window.Models = window.Models || {}, window.Sounds = window.Sounds || {});

