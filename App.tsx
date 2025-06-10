import React from 'react';
import {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Pressable,
  Image,
  Modal,
  TextInput,
  Keyboard,
  Share,
  Alert,
} from 'react-native';

import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import ImageLabeling from '@react-native-ml-kit/image-labeling';
import * as SQLite from 'expo-sqlite';
import {
  Icon,
  MD3Colors,
  Searchbar,
  FAB,
  Button,
  TouchableRipple,
} from 'react-native-paper';

import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

function App() {
  const [dataDisplay, setDataDisplay] = useState([]);
  const [text, onChangeText] = useState('');
  const [currentImage, setCurrentImage] = useState('');

  //--------------------------------------------------------------
  // Load Data from Database
  // if no database exists create database and populate
  //--------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        // connect to db
        const db = await SQLite.openDatabaseAsync('inference');
        //creates and or loads data
        // await db.execAsync(`DROP TABLE IF EXISTS inference;`);
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS inference (id INTEGER PRIMARY KEY NOT NULL, uri TEXT NOT NULL, labels TEXT NOT NULL, ocr TEXT, barcode TEXT);
        `);

        // retrivces all rows from database as an array
        const allRows = await db.getAllAsync(
          'SELECT * FROM inference ORDER BY id DESC',
        );

        // sets data to variable to display later
        setDataDisplay(allRows);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []); // empty to run once

  //--------------------------------------------------------------
  // Upload Image to DB
  // Run inference
  //--------------------------------------------------------------
  const uploadImage = async () => {
    console.log('connecting to database');
    launchImageLibrary(
      {mediaType: 'photo', selectionLimit: 10, includeExtra: true},
      async response => {
        if (!response.didCancel) {
          if (response.assets && response.assets.length > 0) {
            for (let i = 0; i < response.assets.length; i++) {
              console.log('number of images:' + i);
              console.log(response.assets[0].timestamp);
              const labels = await ImageLabeling.label(response.assets[i].uri);
              const barcodes = await BarcodeScanning.scan(
                response.assets[i].uri,
              );
              const ocr = await TextRecognition.recognize(
                response.assets[i].uri,
              );
              addRow(response.assets[i].uri, labels, ocr, barcodes);
            }
          }
        } else {
          console.log(response.errorMessage);
        }
      },
    );
  };

  //--------------------------------------------------------------
  // add row
  //--------------------------------------------------------------
  const addRow = async (uri, labels, ocr, barcode) => {
    console.log('adding row');

    const l = JSON.stringify(labels).toUpperCase();
    const o = JSON.stringify(ocr).toUpperCase();
    const b = JSON.stringify(barcode).toUpperCase();

    const db = await SQLite.openDatabaseAsync('inference');
    const result = await db.runAsync(
      'INSERT INTO inference (uri, labels, ocr, barcode) VALUES (?, ?,?,?)',
      uri,
      l,
      o,
      b,
    );
    console.log('row added');
    refreshData();
  };

  //--------------------------------------------------------------
  // Refresh database
  //--------------------------------------------------------------
  const refreshData = async () => {
    try {
      // connect to db
      const db = await SQLite.openDatabaseAsync('inference');
      const allRows = await db.getAllAsync(
        'SELECT * FROM inference ORDER BY id DESC',
      );

      setDataDisplay(allRows);
      console.log(allRows);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    onChangeText('');
  };

  //--------------------------------------------------------------
  // delete
  //--------------------------------------------------------------
  const deleteRow = async (id: SQLite.SQLiteBindParams) => {
    const db = await SQLite.openDatabaseAsync('inference');
    await db.runAsync('DELETE FROM inference WHERE  id = ?', id); // Binding unnamed parameters from variadic arguments
    refreshData();
  };

  //--------------------------------------------------------------
  // search DB
  //--------------------------------------------------------------
  const searchDB = async searchQuery => {
    // console.log('search value: ' + searchQuery);
    const db = await SQLite.openDatabaseAsync('inference');
    let s = JSON.stringify(searchQuery);
    let b = s.toLocaleUpperCase();
    console.log('search value: ' + b);

    const allRows = await db.getAllAsync(
      `SELECT * FROM inference WHERE INSTR(labels, '${b}') OR INSTR(ocr, '${b}')`,
    );

    setDataDisplay(allRows);
    console.log(allRows);
    for (const row of allRows) {
      console.log(row.id, row.uri, row.labels);
    }
  };

  //--------------------------------------------------------------
  // format for image for display
  //--------------------------------------------------------------
  const renderItem = ({item}) => (
    <View style={styles.imageContainer}>
      <Pressable
        onPress={() => {
          setCurrentImage(item.uri);
          //   setMediaType(item.mediaType);
        }}
        onLongPress={() => {
          deleteRow(item.id);
        }}>
        <Image source={{uri: item.uri}} style={{width: 200, height: 200}} />
      </Pressable>
    </View>
  );

  //--------------------------------------------------------------
  // share to another app
  //--------------------------------------------------------------
  const onShare = async () => {
    try {
      const result = await Share.share({
        message:
          'React Native | A framework for building native apps using React',
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          onChangeText={onChangeText}
          value={text}
          onSubmitEditing={Keyboard.dismiss}
          placeholder="search..."
        />

        <TouchableOpacity onPress={() => searchDB(text)}>
          <Button icon="account" children={undefined} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => refreshData()}>
          <Button icon="account" children={undefined} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* view full image in modal */}
        <Modal visible={currentImage !== ''} transparent={false}>
          <View style={{flex: 1}}>
            <Pressable onPress={() => setCurrentImage('')}>
              <Text
                style={{
                  color: 'black',
                  fontSize: 20,
                  padding: 10,
                  backgroundColor: 'white',
                }}>
                Close
              </Text>
            </Pressable>

            <Pressable onPress={() => onShare()}>
              <Text
                style={{
                  color: 'black',
                  fontSize: 20,
                  padding: 10,
                  backgroundColor: 'white',
                }}>
                Share
              </Text>
            </Pressable>

            <Pressable onPress={() => setCurrentImage('')}>
              <Text
                style={{
                  color: 'black',
                  fontSize: 20,
                  padding: 10,
                  backgroundColor: 'white',
                }}>
                Delete
              </Text>
            </Pressable>

            <Image
              source={{uri: currentImage}}
              style={{width: '100%', height: '100%'}}
            />
          </View>
        </Modal>

        <View style={styles.scrollContainer}>
          <FlatList
            data={dataDisplay}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            numColumns={3}
          />
        </View>

        <FAB icon="plus" style={styles.fab} onPress={() => uploadImage()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'white',
  },

  fab: {
    position: 'absolute',
    margin: 16,
    right: 20,
    bottom: 20,
  },
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 32,
  },
  scrollContainer: {
    flex: 1,
    marginTop: 20,
    width: '100%',
  },
  imageContainer: {
    flex: 1,
    margin: 1,
    aspectRatio: 1, // This ensures that images maintain their aspect ratio
    borderRadius: 5,
    overflow: 'hidden',
  },
  text: {
    fontSize: 20,
    color: 'black',
    fontStyle: 'italic',
  },
  input: {
    flexGrow: 1,
    borderWidth: 0,
    borderRadius: 0,
    padding: 10,
    fontSize: 20,
    color: 'black',
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export default App;
