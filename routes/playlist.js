var express = require('express');
var router = express.Router();
require('dotenv').config();

router.get('/', function (req, res, next) {
    //Snippet adapted from https://github.com/thelinmichael/spotify-web-api-node
    var SpotifyWebApi = require('spotify-web-api-node');
    //Get Client id and secret from env file
    var spotifyApi = new SpotifyWebApi({
        clientId: process.env.CLIENTID,
        clientSecret: process.env.CLIENTSECRET
    });
    //Get access to use Spotify Web API
    spotifyApi.clientCredentialsGrant().then(
        function (data) {
            // Save the access token so that it's used in future calls
            spotifyApi.setAccessToken(data.body['access_token']);
            //Get the track info by calling the following functions:
            return getPlaylistInfo(data.body['access_token'], req, spotifyApi)
                .then(function (trackInfo) {
                    return getIds(trackInfo, spotifyApi);
                })
                .then(function (tracks) {
                    return getEnergyAndValence(tracks, spotifyApi);
                })
                .then(function (trackInfo) {
                    //Render the result page and pass it the track info, playlist id, and user id
                    res.render('result', { tracks: trackInfo, playlistid: req.query['playlistid'], userid: req.query['userid'] });
                });
        },
        function (err) {
            console.log(
                'Something went wrong when retrieving an access token',
                err.message
            );
        }
    );


});

module.exports = router;

//Returns an array of the tracks with placeholders for the energy and valence
function getPlaylistInfo(token, req, spotifyApi) {
    //Snippet adapted from https://github.com/thelinmichael/spotify-web-api-node
    return spotifyApi.getPlaylistTracks(req.query['userid'], req.query['playlistid'], {
        fields: 'items'
    }).then(function (data) {
        tracks = [];
        //Parse JSON response to get track info
        var stringData = JSON.stringify(data.body);
        var jsonData = JSON.parse(stringData);
        for (var i = 0; i < jsonData.items.length; i++) {
            var track = jsonData.items[i].track;
            //Create a string of the list of artists since there can be multiple
            var stringArtists = "";
            for (var j = 0; j < track.artists.length; j++) {
                if (j == track.artists.length - 1)
                    stringArtists += track.artists[j].name;
                else {
                    stringArtists += track.artists[j].name + ", ";
                }
            }
            //Create an object with members representing the information we're going to display
            //Set energy and valence members to 0 as placeholders (they'll be updated in the getEnergyAndValence function)
            //Use the third image in the album images array since its size is 64 by 64
            var trackInfo = {
                id: track.id, name: track.name, artists: stringArtists,
                albumImage: track.album.images[2].url, valence: 0, energy: 0
            };
            //Add the track to the array of tracks
            tracks.push(trackInfo);
        }
        return tracks;
    }, function (err) {
        console.log('Something went wrong!', err);
    });
}

//Returns an array with all of the tracks' ids (or the first 100 ids if the playlist is longer than 100)
function getIds(trackInfo, spotifyApi) {
    var trackIds = [];
    for (var i = 0; i < trackInfo.length; i++) {
        trackIds.push(trackInfo[i].id);
        //If we've reached the 100th track, stop processing any more tracks
        if (i == 99)
            break;
    }
    var tracks = { trackIds: trackIds, trackInfo: trackInfo };
    return tracks;
}

//Returns an updated array of tracks with the energy and valence values added
function getEnergyAndValence(tracks, spotifyApi) {
    //Snippet adapted from https://github.com/thelinmichael/spotify-web-api-node
    //Use the Spotify Web API Node library to retrieve the audio features for multiple tracks
    return spotifyApi.getAudioFeaturesForTracks(tracks.trackIds)
        .then(function (data) {
            var energyAndValences = [];
            //Parse JSON response to retrieve energy and valence from audio features
            var stringData = JSON.stringify(data.body);
            var jsonData = JSON.parse(stringData);
            //Add the energy and valence pairs to an array
            for (var i = 0; i < jsonData.audio_features.length; i++) {
                var energyAndValence = { energy: jsonData.audio_features[i].energy, valence: jsonData.audio_features[i].valence };
                energyAndValences.push(energyAndValence);
            }
            //Update tracks array with values of energy and valence
            for (var k = 0; k < energyAndValences.length; k++) {
                tracks.trackInfo[k].energy = energyAndValences[k].energy;
                tracks.trackInfo[k].valence = energyAndValences[k].valence;
            }
            //Return the updated array of tracks
            return tracks.trackInfo;
        }, function (err) {
            done(err);
        });
}