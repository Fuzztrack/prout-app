// Utilitaire simple pour communiquer le résultat de la recherche
type SearchListener = (friendId: string) => void;

let listeners: SearchListener[] = [];

export const SearchEvents = {
  // S'abonner à la sélection d'un ami
  onFriendSelected: (callback: SearchListener) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },

  // Déclencher la sélection
  selectFriend: (friendId: string) => {
    listeners.forEach(l => l(friendId));
  }
};
